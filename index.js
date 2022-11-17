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

const webhookCallback = bot.webhookCallback(path);

module.exports = function(req, res) {
  if(req.url == '/') {
    res.json({ status: 'ok' });
  } else {
    webhookCallback(req, res);
  }
};

console.log(`Share TikTok Bot serves at ${webhookUrl}`);
bot.telegram.setWebhook(webhookUrl)
  .then(() => console.log('Webhook set'))
  .catch(() => console.log('Failed setting webhook'));
