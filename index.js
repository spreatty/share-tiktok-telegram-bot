const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const https = require('https');
const http2 = require('http2');
const util = require('util');

const WELCOME_MSG = `Вітаю! Я бот, що вміє видобувати відео з TikTok посилань та пересилати їх іншим людям.`;
const ADMIN_MSG = `Зроби мене адміністратором, щоб я міг бачити усі повідомлення.`;
const LINK_MSG = `Перешли це повідомлення до чату, до якого надсилатимеш TikTok посилання. Пам'ятай, я маю бути адміністратором у тому чаті, щоб я міг бачити усі повідомлення.\n\n`;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15';
const headers = {
  'User-Agent': USER_AGENT
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`CREATE TABLE IF NOT EXISTS directions (
  sourceChatId VARCHAR(30) NOT NULL PRIMARY KEY,
  destinationChatId VARCHAR(30) NOT NULL
)`);

const bot = new Telegraf(process.env.BOT_TOKEN);

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
  const isChatLinked = await pool.query('SELECT COUNT(*) AS count FROM directions WHERE sourceChatId = $1', [sourceChatId])
      .then(res => res.rows[0].count > 0);
  if(isChatLinked)
    await pool.query('UPDATE directions SET destinationChatId = $2 WHERE sourceChatId = $1', [sourceChatId, destinationChatId]);
  else
    await pool.query('INSERT INTO directions VALUES ($1, $2)', [sourceChatId, destinationChatId]);
  ctx.reply('Чудово! Відтепер я пересилатиму твої тік-токи до іншого чату.')
});

const videoUrlRegex = /"playAddr"\s*:\s*"(.*?)"/i;
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
  
  console.log('URL: ' + tiktokUrl);

  const body = await httpGet(tiktokUrl, headers);

  const videoConfigMatch = body.match(/"video":(\{.*?playAddr.*?\})/);

  if(videoConfigMatch) {
    const videoConfig = JSON.parse(videoConfigMatch[1]);
    const videoUrl = new URL(videoConfig.playAddr);
    console.log('Fetching video ' + videoUrl);
    https.get(videoUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Host': videoUrl.hostname,
        'Referer': videoUrl.href
      }
    }, response => {
      console.log(response.headers);
      bot.telegram.sendVideo(destinationChatId, { source: response }, { width: videoConfig.width, height: videoConfig.height });
    }).end();
  } else {
    console.log('Forwarding original message and sending html');
    bot.telegram.sendMessage(destinationChatId, ctx.update.message.text);
    bot.telegram.sendDocument(destinationChatId, { source: Buffer.from(body), filename: 'tiktok.html' });
  }
});

bot.launch({
  webhook: {
    domain: 'share-tiktok-telegram-bot.herokuapp.com',
    port: process.env.PORT
  }
});

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  pool.end();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  pool.end();
});

function httpGet(url, headers) {
  if(!(url instanceof URL))
    url = new URL(url);
  return (['m.tiktok.com', 'www.tiktok.com'].includes(url.hostname) ? http2Get : httpsGet)(url, headers);
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      console.log(res.headers);
      if(res.headers.location) {
        httpGet(res.headers.location, headers).then(resolve).catch(reject);
        res.destroy();
      } else {
        res.setEncoding('utf8');
        var data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }
    }).on('error', reject).end();
  });
}

function http2Get(url, headers) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(url).on('error', reject).on('connect', () => {
      const request = client.request({
        ':path': url.pathname,
        ...headers
      }).on('response', resHeaders => {
        console.log(resHeaders);
        if(resHeaders.location) {
          httpGet(resHeaders.location, headers).then(resolve).catch(reject);
          request.close();
          client.close();
        } else {
          request.setEncoding('utf8');
          var data = '';
          request.on('data', chunk => data += chunk);
          request.on('end', () => {
            resolve(data);
            client.close();
          });
        }
      }).on('error', reject).end();
    });
  });
}