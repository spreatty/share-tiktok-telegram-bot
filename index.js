const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const https = require('https');
const http2 = require('http2');
const util = require('util');

const text = require('./text');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15';

const retriesCount = 2;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`CREATE TABLE IF NOT EXISTS links (
  source VARCHAR(30) NOT NULL,
  target VARCHAR(30) NOT NULL,
  PRIMARY KEY (source, target)
)`);
pool.query(`CREATE TABLE IF NOT EXISTS link_registry (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(30) NOT NULL,
  from_source BOOLEAN NOT NULL,
  need_admin BOOLEAN NOT NULL
)`);

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('start', ctx => {
  ctx.reply(text.start);
  ctx.reply(text.whatFor, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: text.whatForOptions.source,
          callback_data: 'source'
        }], [{
          text: text.whatForOptions.target,
          callback_data: 'target'
        }], [{
          text: text.whatForOptions.both,
          callback_data: 'both'
        }]
      ]
    }
  });
});

bot.on('callback_query', ctx => {
  ctx.answerCbQuery();
  const chatId = ctx.callbackQuery.message.chat.id.toString();
  switch(ctx.callbackQuery.data) {
    case 'source':
      setupLink(chatId, true);
      break;
    case 'target':
      setupLink(chatId, false);
      break;
    case 'both':
      setupForBoth(chatId);
  }
});

/*bot.command('unlink', async ctx => {
  const chatId = ctx.update.message.chat.id.toString();
  const { rows } = await pool.query('DELETE FROM links WHERE source = $1 OR target = $1 RETURNING *', [chatId]);

  bot.telegram.sendMessage(source, text.linked.source);
  bot.telegram.sendMessage(target, text.linked.target);
});*/

bot.command('link', async ctx => {
  const [ _, linkIdRaw ] = ctx.update.message.text.split(' ');
  const linkId = parseInt(linkIdRaw);
  if(isNaN(linkId)) {
    ctx.reply(text.error.link.generic);
    return;
  }

  const linkRegistry = await popLinkRegistry(linkId);
  if(!linkRegistry) {
    ctx.reply(text.error.link.badRegistry);
    return;
  }

  var source = linkRegistry.chatId,
    target = ctx.message.chat.id.toString();

  if(source == target) {
    setupForBoth(source);
    return;
  }

  if(!linkRegistry.isFromSource) {
    const tmp = source;
    source = target;
    target = tmp;
  }

  const ok = await link(source, target);
  if(!ok) {
    ctx.reply(text.alreadyLinked);
  } else {
    bot.telegram.sendMessage(source, text.linked.source);
    bot.telegram.sendMessage(target, text.linked.target);
  }
});

async function setupLink(chatId, isFromSource) {
  const linkId = await registerLink(chatId, isFromSource);

  bot.telegram.sendMessage(chatId, text.selectChat[isFromSource ? 'target' : 'source']);
  bot.telegram.sendMessage(chatId, '/link@ShareTikTokBot ' + linkId);
}

async function setupForBoth(chatId) {
  const ok = await link(chatId, chatId);
  bot.telegram.sendMessage(chatId, ok ? text.linked.self : text.alreadyLinkedSelf);
}

async function registerLink(chatId, isFromSource) {
  var { rows } = await pool.query('SELECT id FROM link_registry WHERE chat_id = $1 AND from_source = $2', [chatId, isFromSource]);
  if(!rows.length)
    ({ rows } = await pool.query('INSERT INTO link_registry (chat_id, from_source) VALUES ($1, $2) RETURNING id', [chatId, isFromSource]));
  return rows[0].id;
}

async function popLinkRegistry(linkId) {
  var { rows } = await pool.query('DELETE FROM link_registry WHERE id = $1 RETURNING *', [linkId]);
  return rows.length ? {
    chatId: rows[0].chat_id,
    isFromSource: rows[0].from_source
  } : null;
}

async function isLinkExists(source, target) {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM links WHERE source = $1 AND target = $2', [source, target]);
  return rows[0].count > 0;
}

async function link(source, target) {
  if(await isLinkExists(source, target))
    return false;

  await pool.query('INSERT INTO links VALUES ($1, $2)', [source, target]);
  return true;
}

const videoConfigRegex = /"video":(\{.*?\})/g;
const tiktokUrlRegex = /[\.\/]tiktok.com/i;
bot.url(tiktokUrlRegex, async ctx => {
  console.log(util.inspect(ctx.update, false, 10));
  const source = ctx.update.message.chat.id.toString();
  const { rows } = await pool.query('SELECT target FROM links WHERE source = $1', [source]);
  if(!rows.length)
    return;
  
  const targets = rows.map(row => row.target);

  const tiktokUrl = ctx.update.message.entities.filter(({ type }) => type == 'url')
      .map(({ offset, length }) => ctx.update.message.text.slice(offset, offset + length))
      .find(url => tiktokUrlRegex.test(url));
  
  console.log('URL: ' + tiktokUrl);

  var { urlStack, data } = await httpGet(tiktokUrl, { 'User-Agent': USER_AGENT });
  var videoConfigRaw = data.match(videoConfigRegex)?.find(match => match.includes('playAddr'));

  var i = 1;
  while(i <= retriesCount && !videoConfigRaw) {
    console.log(`Retry #${i} ${urlStack[0]}`);
    ({ data } = await httpGet(urlStack[0], { 'User-Agent': USER_AGENT }));
    videoConfigRaw = data.match(videoConfigRegex)?.find(match => match.includes('playAddr'));
    ++i;
  }

  if(videoConfigRaw) {
    const videoConfig = JSON.parse('{' + videoConfigRaw + '}').video;
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
      broadcast(targets, (target, fileId) => {
        return fileId
          ? bot.telegram.sendVideo(target, fileId)
          : bot.telegram.sendVideo(target, { source: response }, { width: videoConfig.width, height: videoConfig.height });
      });
    }).end();
  } else {
    console.log('Forwarding original message and sending html');
    broadcast(targets, (target, fileId) => {
      bot.telegram.sendMessage(target, ctx.update.message.text);
      return fileId
        ? bot.telegram.sendDocument(target, fileId)
        : bot.telegram.sendDocument(target, { source: Buffer.from(body), filename: 'tiktok.html' });
    });
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

async function broadcast(targets, action) {
  const [ first, ...rest ] = targets;
  const res = await action(first);
  const fileId = res.video ? res.video.file_id : res.document.file_id;
  rest.forEach(target => action(target, fileId));
}

async function httpGet(url, headers) {
  if(!(url instanceof URL))
    url = new URL(url);
  const result = await (['m.tiktok.com', 'www.tiktok.com'].includes(url.hostname) ? http2Get : httpsGet)(url, headers);
  if(!result.urlStack)
    result.urlStack = [];
  result.urlStack.push(url);
  return result;
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
        res.on('end', () => resolve({ data }));
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
            resolve({ data });
            client.close();
          });
        }
      }).on('error', reject).end();
    });
  });
}