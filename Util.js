module.exports = {
  getChatTitle,
  getFullName,
  getUrls,
  searchJSONTree
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

function searchJSONTree(json, field) {
  var found = [];
  Object.entries(json)
    .filter(([_, v]) => v && typeof v == 'object')
    .forEach(([k, v]) => found = found.concat(searchJSONTree(v, field).map(chain => [[k, v]].concat(chain))));
  found = found.concat(Object.entries(json).filter(([k, v]) => k == field).map(e => [e]));
  return found;
}