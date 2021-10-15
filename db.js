const { Pool } = require('pg');
const pool;

module.exports = {
  connect,
  createSchema,
  close,
  getLinks,
  countLinks,
  putLink,
  getLinkRegistry,
  putLinkRegistry,
  deleteLinkRegistry
};

function getLinks(source) {
  return pool.query('SELECT target FROM links WHERE source = $1', [source])
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

function getLinkRegistry(chatId, isFromSource) {
  return pool.query('SELECT id FROM link_registry WHERE chat_id = $1 AND from_source = $2', [chatId, isFromSource])
      .then(result => result.rows);
}

function putLinkRegistry(chatId, isFromSource, needAdmin) {
  return pool.query('INSERT INTO link_registry (chat_id, from_source, need_admin) VALUES ($1, $2, $3) RETURNING id', [chatId, isFromSource, needAdmin])
      .then(result => result.rows);
}

function deleteLinkRegistry(linkId) {
  return pool.query('DELETE FROM link_registry WHERE id = $1 RETURNING *', [linkId])
      .then(result => result.rows);
}

function connect() {
  return pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

function createSchema() {
  pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      source VARCHAR(30) NOT NULL,
      target VARCHAR(30) NOT NULL,
      PRIMARY KEY (source, target)
    );
    CREATE TABLE IF NOT EXISTS link_registry (
      id SERIAL PRIMARY KEY,
      chat_id VARCHAR(30) NOT NULL,
      from_source BOOLEAN NOT NULL,
      need_admin BOOLEAN NOT NULL
    );
  `);
}

function close() {
  pool.end();
}