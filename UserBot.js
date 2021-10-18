const { registerLink, takeLinkRegistry, link, list } = require('./LinkUtil');
const db = require('./db');
const util = require('util');
const text = require('./text');
const props = require('./props');

module.exports = {
  addHandlers() {
    bot.command('start', start);
    bot.on('callback_query', callbackQuery);
    bot.hears(/^@ShareTikTokBot link [\w-]+$/, onLink);
    bot.command('list', onList);
    bot.command('unlink', unlink);
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
  const [ command, ...params ] = ctx.callbackQuery.data.split(' ');
  switch(command) {
    case 'link':
      cbLink(ctx, chatId, params);
      break;
    case 'unlink':
      cbUnlink(ctx, chatId, params);
      break;
  }
}

function cbLink(_, chatId, [ action ]) {
  switch(action) {
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

async function cbUnlink(ctx, chatId, [ dir, linkedChatId, ...name ]) {
  name = name.join(' ');
  var didDelete;

  switch(dir) {
    case 'loop':
      didDelete = (await db.deleteLink(chatId, chatId)).length;
      ctx.reply(didDelete ? text.unlinked.loop : text.notLinkedLoop);
      break;
    case 'from':
      didDelete = (await db.deleteLink(chatId, linkedChatId)).length;
      ctx.reply(text.get(didDelete ? text.unlinked.from : text.notLinked, name));
      break;
    case 'to':
      didDelete = (await db.deleteLink(linkedChatId, chatId)).length;
      ctx.reply(text.get(didDelete ? text.unlinked.to : text.notLinked, name));
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

async function onList(ctx) {
  const chatId = ctx.update.message.chat.id.toString();
  const { from, to, loop } = await list(chatId);

  const fromMsg = from.length && text.list.from + '\n' + from.map(link => link.name).join('\n');
  const toMsg = to.length && text.list.to + '\n' + to.map(link => link.name).join('\n');
  const loopMsg = loop && text.list.loop;
  const msg = [toMsg, fromMsg, loopMsg].filter(str => str).join('\n\n');

  ctx.reply(msg);
}

async function unlink(ctx) {
  const chatId = ctx.update.message.chat.id.toString();
  const { from, to, loop } = await list(chatId);

  if(loop)
    await ctx.reply(text.unlink.loop, props.unlinkLoop);

  if(from.length)
    await ctx.reply(text.unlink.from, {
      reply_markup: {
        inline_keyboard: from.map(link => [{
          text: link.name,
          callback_data: `unlink from ${link.chatId} ${link.name}`
        }])
      }
    });
  
  if(to.length)
    await ctx.reply(text.unlink.to, {
      reply_markup: {
        inline_keyboard: to.map(link => [{
          text: link.name,
          callback_data: `unlink to ${link.chatId} ${link.name}`
        }])
      }
    });
}