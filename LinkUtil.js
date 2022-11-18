const db = require('./db');
const Util = require('./Util');

module.exports = {
  list
};

async function list(chatId) {
  const targets = await db.getTargets(chatId);
  const sources = await db.findSources(chatId);
  
  const from = completeChatsInfo(targets, chatId);
  const to = completeChatsInfo(sources, chatId);

  return {
    from: await Promise.all(from),
    to: await Promise.all(to),
    hasLoop: targets.includes(chatId)
  };
}

function completeChatsInfo(chats, mainChatId) {
  return chats.filter(item => item != mainChatId)
    .map(chatId => bot.telegram.getChat(chatId)
      .then(Util.getChatTitle)
      .then(name => ({ name, chatId })));
}