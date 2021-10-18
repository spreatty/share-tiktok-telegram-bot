const db = require('./db');
const Util = require('./Util');

module.exports = {
  registerLink,
  takeLinkRegistry,
  link,
  list
};

async function registerLink(chatId, isFromSource = false) {
  var rows = await db.getLinkRegistry(chatId, isFromSource);
  if(!rows.length)
    rows = await db.putLinkRegistry(chatId, isFromSource);
  return rows[0].id;
}

async function takeLinkRegistry(linkId) {
  const rows = await db.deleteLinkRegistry(linkId);
  return rows.length ? {
    chatId: rows[0].chat_id,
    isFromSource: rows[0].from_source
  } : null;
}

async function isLinkExists(source, target) {
  return await db.countLinks(source, target) > 0;
}

async function link(source, target) {
  if(await isLinkExists(source, target))
    return false;

  await db.putLink(source, target);
  return true;
}

async function list(chatId) {
  const rows = await db.getRelatedLinks(chatId);

  const promises = rows.map(({ source, target }) => {
    const type = source == target ? 'loop' : chatId == source ? 'from' : 'to';
    const link = {
      type,
      chatId: type == 'from' ? target : source
    };
    return type == 'loop' ? link : bot.telegram.getChat(link.chatId)
        .then(chat => { link.name = Util.where(chat); return link; });
  });

  const chats = await Promise.all(promises);
  const loop = chats.find(chat => chat.type == 'loop');
  const from = chats.filter(chat => chat.type == 'from');
  const to = chats.filter(chat => chat.type == 'to');

  return {
    from,
    to,
    loop
  };
}