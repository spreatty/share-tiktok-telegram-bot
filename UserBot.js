const { registerLink, takeLinkRegistry, link } = require('./LinkUtil');
const util = require('util');
const text = require('./text');
const props = require('./props');

module.exports = {
  addHandlers() {
    bot.command('start', start);
    bot.on('callback_query', callbackQuery);
    bot.hears(/^@ShareTikTokBot link [\w-]+$/, onLink);
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