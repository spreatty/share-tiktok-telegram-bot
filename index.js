const { Telegraf } = require('telegraf');
const util = require('util');

const bot = new Telegraf(process.env.BOT_TOKEN);
const path = '/' + encodeURIComponent(process.env.BOT_TOKEN);

bot.telegram.setWebhook('https://share-tiktok-telegram-bot.herokuapp.com' + path);
bot.startWebhook(path, null, process.env.PORT || 8080);

bot.start(ctx => {
  util.inspect(ctx, false, 15);
  ctx.reply('Welcome');
});
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));