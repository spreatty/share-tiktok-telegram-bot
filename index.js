const { Telegraf } = require('telegraf');
const { Client } = require('pg');
const util = require('util');

const bot = new Telegraf(process.env.BOT_TOKEN);
const path = '/' + encodeURIComponent(process.env.BOT_TOKEN);

bot.telegram.setWebhook('https://share-tiktok-telegram-bot.herokuapp.com' + path);
bot.startWebhook(path, null, process.env.PORT || 8080);

bot.start(ctx => {
  console.log(util.inspect(ctx.update, false, 10));
  ctx.reply('Welcome');
});
bot.hears('give', ctx => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  client.connect();

  client.query('SELECT table_schema,table_name FROM information_schema.tables;', (err, res) => {
    if (err) throw err;
    ctx.reply(JSON.stringify(res.rows));
    client.end();
  });
});
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));