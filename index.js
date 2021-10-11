const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const util = require('util');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query(`CREATE TABLE IF NOT EXISTS directions (
  sourceChatId INTEGER NOT NULL PRIMARY KEY,
  destinationChatId INTEGER NOT NULL
)`);

const bot = new Telegraf(process.env.BOT_TOKEN);
const path = '/' + encodeURIComponent(process.env.BOT_TOKEN);

bot.telegram.setWebhook('https://share-tiktok-telegram-bot.herokuapp.com' + path);
bot.startWebhook(path, null, process.env.PORT || 8080);

bot.start(ctx => {
  console.log(util.inspect(ctx.update, false, 10));
  ctx.reply('Вітаю! Я бот, що вміє видобувати відео з TikTok посилань та пересилати їх іншим людям. Перешли це повідомлення до чату, куди я надсилатиму відео.');
});
bot.on('text', ctx => {
  /*pool.query('SELECT table_schema,table_name FROM information_schema.tables LIMIT 3', (err, res) => {
    if (err) throw err;
    ctx.reply(JSON.stringify(res.rows));
  });*/
  console.log(util.inspect(ctx.update, false, 10));
});
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  pool.end();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  pool.end();
});