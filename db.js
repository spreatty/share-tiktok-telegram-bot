const sqlite3 = require('sqlite3').verbose();
var db;

module.exports = {
  connect,
  createSchema,
  close,
  query,
  getTargets,
  getRelatedLinks,
  countLinks,
  putLink,
  deleteLink,
  getLinkRegistry,
  putLinkRegistry,
  deleteLinkRegistry
};

function query(sql) {
  return new Promise(resolve => db.all(sql, (err, rows) => resolve(rows)));
}

function getTargets(source) {
  return new Promise(resolve => db.all('SELECT target FROM links WHERE source = ?1', [source], (err, rows) => resolve(rows)));
}

function getRelatedLinks(chatId) {
  return new Promise(resolve => db.all('SELECT source, target FROM links WHERE source = ?1 OR target = ?1', [chatId], (err, rows) => resolve(rows)));
}

function countLinks(source, target) {
  return new Promise(resolve => db.all('SELECT COUNT(*) AS count FROM links WHERE source = ?1 AND target = ?2', [source, target], (err, rows) => resolve(rows[0].count)));
}

function putLink(source, target) {
  return new Promise(resolve => db.run('INSERT INTO links VALUES (?1, ?2)', [source, target], function(){ resolve(this.changes); }));
}

function deleteLink(source, target) {
  return new Promise(resolve => db.run('DELETE FROM links WHERE source = ?1 AND target = ?2', [source, target], function(){ resolve(this.changes); }));
}

function getLinkRegistry(chatId, isFromSource) {
  return new Promise(resolve => db.all('SELECT id FROM link_registry WHERE chat_id = ?1 AND from_source = ?2', [chatId, isFromSource], (err, rows) => resolve(rows)));
}

function putLinkRegistry(uuid, chatId, isFromSource) {
  return new Promise(resolve => db.run('INSERT INTO link_registry VALUES (?1, ?2, ?3)', [uuid, chatId, isFromSource], function(){ resolve(this.changes); }));
}

function deleteLinkRegistry(linkId) {
  return new Promise(resolve => db.all('DELETE FROM link_registry WHERE id = ?1 RETURNING *', [linkId], (err, rows) => resolve(rows)));
}

function connect() {
  return new Promise((resolve, reject) => db = new sqlite3.Database('./data.db', error => error ? reject(error) : resolve()));
}

function createSchema() {
  return new Promise(resolve => db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        source INT NOT NULL,
        target INT NOT NULL,
        PRIMARY KEY (source, target)
      );
      CREATE TABLE IF NOT EXISTS link_registry (
        id CHAR(36) NOT NULL,
        chat_id INT NOT NULL,
        from_source BOOLEAN NOT NULL,
        PRIMARY KEY (id)
      );
    `, resolve));
}

function close() {
  return new Promise(resolve => db.close(resolve));
}