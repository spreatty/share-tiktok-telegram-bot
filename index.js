const { Telegraf } = require('telegraf');
const { isTiktokUrl, onTiktok } = require('./Tiktok');
const UserBot = require('./UserBot');
const AdminBot = require('./AdminBot');
const db = require('./db');

db.connect();
db.createSchema();

const bot = global.bot = new Telegraf(process.env.BOT_TOKEN);

process.once('SIGINT', () => {
  bot.stop('SIGINT');
  db.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  db.close();
});

UserBot.addHandlers();
AdminBot.addHandlers();

bot.url(isTiktokUrl, onTiktok);

bot.launch({
  webhook: {
    domain: 'share-tiktok-telegram-bot.herokuapp.com',
    port: process.env.PORT
  }
});
