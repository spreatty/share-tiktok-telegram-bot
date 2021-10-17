module.exports = {
  where,
  name
};

function where(chat) {
  return chat.title || name(chat);
}

function name(chat) {
  return chat.first_name + (chat.last_name ? ' ' + chat.last_name : '');
}