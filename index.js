const { Telegraf } = require('telegraf');
const { isTiktokUrl, onTiktok } = require('./Tiktok');
const UserBot = require('./UserBot');
const AdminBot = require('./AdminBot');
const db = require('./db');

const bot = global.bot = new Telegraf(process.env.SHARE_TIKTOK_BOT_TOKEN);
const path = '/api/telegraf?token=' + process.env.SHARE_TIKTOK_BOT_TOKEN;
const webhookUrl = 'https://' + process.env.SHARE_TIKTOK_BOT_DOMAIN + path;

bot.use((ctx, next) => {
  console.log(JSON.stringify(ctx.update));
  next();
});

UserBot.addHandlers();
AdminBot.addHandlers();
bot.url(isTiktokUrl, onTiktok);

db.init(process.env.SHARE_TIKTOK_BOT_DB_CONN);

module.exports = bot.webhookCallback(path);

console.log(`Share TikTok Bot serves at ${webhookUrl}`);
bot.telegram.setWebhook(webhookUrl)
  .then(() => console.log('Webhook set'))
  .catch(() => console.log('Failed setting webhook'));
