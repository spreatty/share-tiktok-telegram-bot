const functions = require('@google-cloud/functions-framework');
const { Telegraf } = require('telegraf');
const { isTiktokUrl, onTiktok } = require('./Tiktok');
const UserBot = require('./UserBot');
const AdminBot = require('./AdminBot');
const util = require('util');

const bot = global.bot = new Telegraf(process.env.BOT_TOKEN);

bot.use((ctx, next) => {
  console.log(util.inspect(ctx.update, false, 10));
  next();
});

UserBot.addHandlers();
AdminBot.addHandlers();

bot.url(isTiktokUrl, onTiktok);

const host = process.env.BOT_HOST;
const path = `/telegraf/${bot.secretPathComponent()}`;

console.log(`Setting webhook to https://${host}${path}`);
bot.telegram.setWebhook(`https://${host}${path}`);

functions.http('shareTikTokBot', bot.webhookCallback(path));
