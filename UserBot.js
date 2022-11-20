const { list } = require('./LinkUtil');
const Util = require('./Util');
const db = require('./db');
const text = require('./text');
const props = require('./props');

module.exports = {
  addHandlers() {
    bot.command('start', start);
    bot.on('callback_query', callbackQuery);
    bot.hears(/^@ShareTikTokBot link [\w-]+$/, onLink);
    bot.command('list', onList);
    bot.command('unlink', unlink);
    bot.command('feedback', feedback);
  }
};

function start(ctx) {
  ctx.reply(text.start).then(() =>
  ctx.reply(text.whatFor, props.whatFor));
}

function callbackQuery(ctx) {
  const chatId = ctx.update.callback_query.message.chat.id;
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

function cbLink(ctx, chatId, [ action ]) {
  switch(action) {
    case 'source':
      setupLink(ctx, chatId, true);
      break;
    case 'target':
      setupLink(ctx, chatId, false);
      break;
    case 'both':
      setupForBoth(ctx, chatId);
  }
}

async function cbUnlink(ctx, chatId, [ dir, linkedChatId, ...name ]) {
  name = name.join(' ');
  var didDelete;

  switch(dir) {
    case 'loop':
      didDelete = await db.deleteLink(chatId, chatId);
      ctx.answerCbQuery();
      ctx.reply(didDelete ? text.unlinked.loop : text.notLinkedLoop);
      break;
    case 'from':
      didDelete = await db.deleteLink(chatId, linkedChatId);
      ctx.answerCbQuery();
      ctx.reply(text.get(didDelete ? text.unlinked.from : text.notLinked, name));
      break;
    case 'to':
      didDelete = await db.deleteLink(linkedChatId, chatId);
      ctx.answerCbQuery();
      ctx.reply(text.get(didDelete ? text.unlinked.to : text.notLinked, name));
  }
}

async function setupLink(ctx, chatId, isFromSource) {
  const regId = await db.obtainRegistryId(chatId, isFromSource);
  ctx.answerCbQuery();
  bot.telegram.sendMessage(chatId, text.selectChat[isFromSource ? 'target' : 'source'], props.selectChat(regId));
}

async function setupForBoth(ctx, chatId) {
  const ok = await db.addLink(chatId, chatId);
  ctx.answerCbQuery();
  bot.telegram.sendMessage(chatId, ok ? text.linked.self : text.alreadyLinkedSelf);
}

async function onLink(ctx) {
  const regId = ctx.update.message.text.split(' ')[2];
  
  const registry = await db.pullRegistry(regId);
  if(!registry) {
    ctx.reply(text.error.link.badRegistry);
    return;
  }
  
  const chatId = ctx.update.message.chat.id;
  var source = registry.chatId,
      target = chatId;
  
  if(source == target) {
    setupForBoth(source);
    return;
  }
  
  if(!registry.isFromSource) {
    source = chatId;
    target = registry.chatId;
  }
  
  const ok = await db.addLink(source, target);
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
  const chatId = ctx.update.message.chat.id;
  const { from, to, hasLoop } = await list(chatId);

  const fromMsg = from.length && text.list.from + '\n' + from.map(link => link.name).join('\n');
  const toMsg = to.length && text.list.to + '\n' + to.map(link => link.name).join('\n');
  const loopMsg = hasLoop && text.list.loop;
  const msg = [loopMsg, toMsg, fromMsg].filter(str => str).join('\n\n');

  ctx.reply(msg || text.list.nothing);
}

async function unlink(ctx) {
  const chatId = ctx.update.message.chat.id;
  const { from, to, hasLoop } = await list(chatId);

  if(hasLoop)
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

function feedback(ctx) {
  const msg = ctx.update.message.text.slice('/feedback '.length);
  const from = ctx.update.message.chat.username || Util.getChatTitle(ctx.update.message.chat);
  const fromId = ctx.update.message.chat.id;
  bot.telegram.sendMessage(process.env.BOT_OWNER, `${from}\n${fromId}\n${msg}`);
};