const db = require('./db');

module.exports = {
  registerLink,
  takeLinkRegistry,
  link
};

async function registerLink(chatId, isFromSource = false) {
  var rows = await db.getLinkRegistry(chatId, isFromSource);
  if(!rows.length)
    rows = await db.putLinkRegistry(chatId, isFromSource);
  return rows[0].id;
}

async function takeLinkRegistry(linkId) {
  var rows = await db.deleteLinkRegistry(linkId);
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