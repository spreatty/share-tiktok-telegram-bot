const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const http2 = require('http2-client');
const util = require('util');

const WELCOME_MSG = `Вітаю! Я бот, що вміє видобувати відео з TikTok посилань та пересилати їх іншим людям.`;
const ADMIN_MSG = `Зроби мене адміністратором, щоб я міг бачити усі повідомлення.`;
const LINK_MSG = `Перешли це повідомлення до чату, до якого надсилатимеш TikTok посилання. Пам'ятай, я маю бути адміністратором у тому чаті, щоб я міг бачити усі повідомлення.\n\n`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`CREATE TABLE IF NOT EXISTS directions (
  sourceChatId VARCHAR(30) NOT NULL PRIMARY KEY,
  destinationChatId VARCHAR(30) NOT NULL
)`);

const bot = new Telegraf(process.env.BOT_TOKEN);
const path = '/' + encodeURIComponent(process.env.BOT_TOKEN);

bot.telegram.setWebhook('https://share-tiktok-telegram-bot.herokuapp.com' + path);
bot.startWebhook(path, null, process.env.PORT || 8080);

const pairingChatIds = [];
const directions = {};

bot.start(ctx => {
  console.log(util.inspect(ctx.update, false, 10));
  var welcome = WELCOME_MSG;
  if(ctx.update.message.chat.type == 'group')
    welcome += ADMIN_MSG;
  ctx.reply(welcome);
});

bot.command('link', ctx => {
  console.log(util.inspect(ctx.update, false, 10));
  const destinationChatId = ctx.update.message.chat.id.toString();
  pairingChatIds.push(destinationChatId);
  ctx.reply(LINK_MSG + destinationChatId);
});

bot.command('unlink', async ctx => {
  console.log(util.inspect(ctx.update, false, 10));
  const chatId = ctx.update.message.chat.id.toString();
  await pool.query('DELETE FROM directions WHERE sourceChatId = $1 OR destinationChatId = $1', [chatId]);
  ctx.reply('Я більше не пересилатиму з цього чату / у цей чат.');
});

bot.on('text', async (ctx, next) => {
  console.log(util.inspect(ctx.update, false, 10));
  if(!ctx.update.message.text.startsWith(LINK_MSG))
    return next();
  
  const destinationChatId = ctx.update.message.text.slice(LINK_MSG.length);
  if(!pairingChatIds.includes(destinationChatId))
    return next();

  pairingChatIds.splice(pairingChatIds.indexOf(destinationChatId), 1);
  const sourceChatId = ctx.update.message.chat.id.toString();
  await pool.query('INSERT INTO directions VALUES ($1, $2)', [sourceChatId, destinationChatId]);
  ctx.reply('Чудово! Відтепер я пересилатиму твої тік-токи до іншого чату.')
});

const videoUrlRegex = /<meta property="og:video:secure_url" content="(.*?)"/;
const tiktokUrlRegex = /[\.\/]tiktok.com/i;
bot.url(tiktokUrlRegex, async ctx => {
  const sourceChatId = ctx.update.message.chat.id.toString();
  const dbResult = await pool.query('SELECT destinationChatId FROM directions WHERE sourceChatId = $1', [sourceChatId]);
  //console.log(util.inspect(dbResult, false, 5));
  if(!dbResult.rows.length)
    return;
  
  const destinationChatId = dbResult.rows[0].destinationchatid;

  const tiktokUrl = ctx.update.message.entities.filter(({ type }) => type == 'url')
      .map(({ offset, length }) => ctx.update.message.text.slice(offset, offset + length))
      .find(url => tiktokUrlRegex.test(url));
  
  const body = await http2get(tiktokUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'
    }
  });

  const videoUrlMatch = videoUrlRegex.exec(body);
  if(videoUrlMatch)
    bot.telegram.sendVideo(destinationChatId, videoUrlMatch[1]);
  else
    bot.telegram.sendMessage(destinationChatId, ctx.update.message.text);
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

function http2get(url, options) {
  return new Promise((resolve, reject) => {
    http2.get(url, options, response => {
      if(response.headers.location) {
        http2get(response.headers.location, options).then(resolve);
        response.destroy();
      } else {
        var data = '';
        response.setEncoding('utf8');
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          resolve(data);
        });
      }
    }).end();
  });
}