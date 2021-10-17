const db = require('./db');

module.exports = {
  registerLink,
  takeLinkRegistry,
  link
};

async function registerLink(chatId, chatName, isFromSource = false) {
  var rows = await db.getLinkRegistry(chatId, isFromSource);
  if(!rows.length)
    rows = await db.putLinkRegistry(chatId, chatName, isFromSource);
  return rows[0].id;
}

async function takeLinkRegistry(linkId) {
  var rows = await db.deleteLinkRegistry(linkId);
  return rows.length ? {
    chatId: rows[0].chat_id,
    chatName: rows[0].chat_name,
    isFromSource: rows[0].from_source
  } : null;
}

async function isLinkExists(source, target) {
  return await db.countLinks(source, target) > 0;
}

async function link(source, target, sourceName, targetName) {
  if(await isLinkExists(source, target))
    return false;

  await db.putLink(source, target, sourceName, targetName);
  return true;
}