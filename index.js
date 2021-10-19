const { Telegraf } = require('telegraf');
const { isTiktokUrl, onTiktok } = require('./Tiktok');
const UserBot = require('./UserBot');
const AdminBot = require('./AdminBot');
const db = require('./db');
const util = require('util');

db.connect();
db.createSchema();

const bot = global.bot = new Telegraf(process.env.BOT_TOKEN);
bot.on('text', (ctx, next) => {
  console.log(util.inspect(ctx.update, false, 10));
  next();
});

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
