const { registerLink, takeLinkRegistry, link } = require('./LinkUtil');
const db = require('./db');
const Util = require('./Util');
const util = require('util');
const text = require('./text');
const props = require('./props');

module.exports = {
  addHandlers() {
    bot.command('start', start);
    bot.on('callback_query', callbackQuery);
    bot.hears(/^@ShareTikTokBot link [\w-]+$/, onLink);
    bot.command('list', list)
  }
};

function start(ctx) {
  ctx.reply(text.start).then(() =>
  ctx.reply(text.whatFor, props.whatFor));
}

function callbackQuery(ctx) {
  console.log(util.inspect(ctx.update, false, 10));
  
  ctx.answerCbQuery();
  
  const chatId = ctx.update.callback_query.message.chat.id.toString();
  switch(ctx.callbackQuery.data) {
    case 'source':
      setupLink(chatId, true);
      break;
    case 'target':
      setupLink(chatId, false);
      break;
    case 'both':
      setupForBoth(chatId);
  }
}

async function setupLink(chatId, isFromSource) {
  const linkId = await registerLink(chatId, isFromSource);
  
  bot.telegram.sendMessage(chatId, text.selectChat[isFromSource ? 'target' : 'source'], props.selectChat(linkId));
}

async function setupForBoth(chatId) {
  const ok = await link(chatId, chatId);
  bot.telegram.sendMessage(chatId, ok ? text.linked.self : text.alreadyLinkedSelf);
}

async function onLink(ctx) {
  const linkId = ctx.update.message.text.split(' ')[2];
  
  const linkRegistry = await takeLinkRegistry(linkId);
  if(!linkRegistry) {
    ctx.reply(text.error.link.badRegistry);
    return;
  }
  
  const chatId = ctx.update.message.chat.id.toString();
  var source = linkRegistry.chatId,
      target = chatId;
  
  if(source == target) {
    setupForBoth(source);
    return;
  }
  
  if(!linkRegistry.isFromSource) {
    source = chatId;
    target = linkRegistry.chatId;
  }
  
  const ok = await link(source, target);
  if(!ok) {
    await ctx.reply(text.alreadyLinked);
  } else {
    await Promise.all([
      bot.telegram.sendMessage(source, text.linked.source),
      bot.telegram.sendMessage(target, text.linked.target)
    ]);
  }
}

/*bot.command('unlink', async ctx => {
  const chatId = ctx.update.message.chat.id.toString();
  const rows = await pool.query('DELETE FROM links WHERE source = $1 OR target = $1 RETURNING *', [chatId]);
  
  bot.telegram.sendMessage(source, text.linked.source);
  bot.telegram.sendMessage(target, text.linked.target);
});*/

async function list(ctx) {
  const chatId = ctx.update.message.chat.id.toString();
  const rows = db.getRelatedLinks(chatId);
  const promises = rows.map(({ source, target }) => {
    const type = source == target ? 'loop' : chatId == source ? 'from' : 'to';
    const data = { type };
    return type == 'loop' ? data : bot.telegram.getChat(type == 'from' ? target : source)
        .then(chat => {
          data.name = Util.where(chat);
          return data;
        });
  });

  const chats = await Promise.all(promises);
  const hasLoop = chats.some(chat => chat.type == 'loop');
  const froms = chats.filter(chat => chat.type == 'from').map(chat => chat.name);
  const tos = chats.filter(chat => chat.type == 'to').map(chat => chat.name);

  const fromMsg = froms.length && text.list.from + '\n' + froms.join('\n');
  const toMsg = tos.length && text.list.to + '\n' + tos.join('\n');
  const loopMsg = hasLoop && text.list.loop;
  const msg = [fromMsg, toMsg, loopMsg].filter(str => str).join('\n\n');

  ctx.reply(msg);
}