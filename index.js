const express = require('express');
const { Telegraf } = require('telegraf');
const { isTiktokUrl, onTiktok } = require('./Tiktok');
const UserBot = require('./UserBot');
const AdminBot = require('./AdminBot');
const db = require('./db');

const bot = global.bot = new Telegraf(process.env.SHARE_TIKTOK_BOT_TOKEN);
const path = '/telegraf/' + bot.secretPathComponent();
const webhookUrl = 'https://' + process.env.SHARE_TIKTOK_BOT_DOMAIN + path;

bot.use((ctx, next) => {
  console.log(JSON.stringify(ctx.update));
  next();
});

UserBot.addHandlers();
AdminBot.addHandlers();
bot.url(isTiktokUrl, onTiktok);

db.init(process.env.SHARE_TIKTOK_BOT_DB_CONN);

const app = express();
const webhookCallback = bot.webhookCallback(path);

app.get('/', (req, res) => {
  res.send({ status: 'ok' });
});

app.post(path, (req, res) => {
  console.log('Webhook request');
  webhookCallback(req, res);
});

const server = app.listen(process.env.PORT || 8080, () => {
  console.log(`Ready. Share TikTok Bot serves at ${webhookUrl}`);
  bot.telegram.setWebhook(webhookUrl)
    .then(() => console.log('Webhook set'))
    .catch(() => console.log('Failed setting webhook'));
});

const exit = () => {
  Promise.all(new Promise(resolve => server.close(resolve)), db.close())
    .then(() => server.closeAllConnections())
    .then(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};

process.once('SIGINT', exit);
process.once('SIGTERM', exit);