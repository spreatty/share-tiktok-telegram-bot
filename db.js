const { Pool } = require('pg');
var pool;

module.exports = {
  connect,
  createSchema,
  close,
  query,
  getLinks,
  countLinks,
  putLink,
  getLinkRegistry,
  putLinkRegistry,
  deleteLinkRegistry
};

function query(sql) {
  return pool.query(sql).then(result => result.rows);
}

function getLinks(source) {
  return pool.query('SELECT target FROM links WHERE source = $1', [source])
      .then(result => result.rows);
}

function countLinks(source, target) {
  return pool.query('SELECT COUNT(*) AS count FROM links WHERE source = $1 AND target = $2', [source, target])
      .then(result => result.rows[0].count);
}

function putLink(source, target, sourceName, targetName) {
  return pool.query('INSERT INTO links VALUES ($1, $2, $3, $4)', [source, target, sourceName, targetName])
      .then(result => result.rows);
}

function getLinkRegistry(chatId, isFromSource) {
  return pool.query('SELECT id FROM link_registry WHERE chat_id = $1 AND from_source = $2', [chatId, isFromSource])
      .then(result => result.rows);
}

function putLinkRegistry(chatId, chatName, isFromSource) {
  return pool.query('INSERT INTO link_registry (chat_id, chat_name, from_source) VALUES ($1, $2, $3) RETURNING id', [chatId, chatName, isFromSource])
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
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE IF NOT EXISTS links (
      source VARCHAR(30) NOT NULL,
      target VARCHAR(30) NOT NULL,
      source_name VARCHAR(250),
      target_name VARCHAR(250),
      PRIMARY KEY (source, target)
    );
    CREATE TABLE IF NOT EXISTS link_registry (
      id UUID DEFAULT uuid_generate_v4(),
      chat_id VARCHAR(30) NOT NULL,
      chat_name VARCHAR(250) NOT NULL,
      from_source BOOLEAN NOT NULL,
      PRIMARY KEY (id)
    );
  `);
}

function close() {
  pool.end();
}