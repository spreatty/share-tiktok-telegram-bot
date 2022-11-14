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
  deleteLinkRegistry,
  getVideoByUrl,
  putVideo,
  putUrlRecord
};

function query(sql) {
  return pool.query(sql).then(result => result.rows);
}

function getTargets(source) {
  return pool.query('SELECT target FROM links WHERE source = $1', [source])
      .then(result => result.rows);
}

function getRelatedLinks(chatId) {
  return pool.query('SELECT source, target FROM links WHERE source = $1 OR target = $1', [chatId])
      .then(result => result.rows);
}

function countLinks(source, target) {
  return pool.query('SELECT COUNT(*) AS count FROM links WHERE source = $1 AND target = $2', [source, target])
      .then(result => result.rows[0].count);
}

function putLink(source, target) {
  return pool.query('INSERT INTO links VALUES ($1, $2)', [source, target])
      .then(result => result.rows);
}

function deleteLink(source, target) {
  return pool.query('DELETE FROM links WHERE source = $1 AND target = $2 RETURNING *', [source, target])
      .then(result => result.rows);
}

function getLinkRegistry(chatId, isFromSource) {
  return pool.query('SELECT id FROM link_registry WHERE chat_id = $1 AND from_source = $2', [chatId, isFromSource])
      .then(result => result.rows);
}

function putLinkRegistry(chatId, isFromSource) {
  return pool.query('INSERT INTO link_registry (chat_id, from_source) VALUES ($1, $2) RETURNING id', [chatId, isFromSource])
      .then(result => result.rows);
}

function deleteLinkRegistry(linkId) {
  return pool.query('DELETE FROM link_registry WHERE id = $1 RETURNING *', [linkId])
      .then(result => result.rows);
}

function getVideoByUrl(url) {
  return pool.query('UPDATE videos SET used = used + 1, touched = CURRENT_TIMESTAMP WHERE file_id = (SELECT file_id FROM urls WHERE url = $1) RETURNING file_id, slides, width, height', [url])
      .then(result => result.rows);
}

function putVideo(fileId, slides, width, height) {
  return pool.query('INSERT INTO videos (file_id, slides, width, height) VALUES ($1, $2, $3, $4)', [fileId, slides, width, height])
      .then(result => result.rows);
}

function putUrlRecord(url, fileId) {
  return pool.query('INSERT INTO urls (url, file_id) VALUES ($1, $2)', [url, fileId])
      .then(result => result.rows);
}

function connect() {
  return new Promise(resolve => db = new sqlite3.Database('./data.db', resolve));
}

function createSchema() {
  pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      source VARCHAR(30) NOT NULL,
      target VARCHAR(30) NOT NULL,
      PRIMARY KEY (source, target)
    );
    CREATE TABLE IF NOT EXISTS link_registry (
      id UUID DEFAULT uuid_generate_v4(),
      chat_id VARCHAR(30) NOT NULL,
      from_source BOOLEAN NOT NULL,
      PRIMARY KEY (id)
    );
    CREATE TABLE IF NOT EXISTS videos (
      file_id VARCHAR(250) PRIMARY KEY,
      slides TEXT,
      width INTEGER,
      height INTEGER,
      used INTEGER NOT NULL DEFAULT 1,
      created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      touched TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS urls (
      url VARCHAR(250) PRIMARY KEY,
      file_id VARCHAR(250) NOT NULL,
      CONSTRAINT fk_video FOREIGN KEY(file_id) REFERENCES videos(file_id)
    );
  `);
}

function close() {
  pool.end();
}