module.exports = {
  getChatTitle,
  getFullName,
  getUrls
};

function getChatTitle(chat) {
  return chat.title || getFullName(chat);
}

function getFullName(nameData) {
  return nameData.first_name + (nameData.last_name ? ' ' + nameData.last_name : '');
}

function getUrls(entities, text) {
  return entities
      .filter(entity => entity.type == 'url')
      .map(({ offset, length }) => text.slice(offset, offset + length));
}