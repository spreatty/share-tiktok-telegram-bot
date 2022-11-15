const vm = require('vm');
const db = require('./db');
const Util = require('./Util');
const m3u8stream = require('m3u8stream');

module.exports = {
  addHandlers() {
    bot.command('exec', exec);
  }
};

function accessCheck(ctx) {
  if(ctx.update.message.chat.username != 'spreatty')
    throw new Error('Admin access denied for ' + (ctx.update.message.chat.username || Util.getChatTitle(ctx.update.message.chat)));
}

async function exec(ctx) {
  accessCheck(ctx);

  const code = ctx.update.message.text.slice('/exec '.length);
  vm.runInNewContext(code, { bot, ctx, db, console, m3u8stream });
}

/*async function sql(ctx) {
  accessCheck(ctx);

  const sql = ctx.update.message.text.slice('/sql '.length);

  var rows;
  try {
    rows = await db.query(sql);
  } catch(error) {
    ctx.reply('Error: ' + error.message);
    return;
  }

  if(!rows.length) {
    ctx.reply('Empty response');
    return;
  }

  const padding = 2;
  var columns = Object.keys(rows[0]);
  
  rows = rows.slice(0, 50).map(row => Object.values(row).map(val => val.toString()));

  var widths = columns.map(txt => txt.length);
  rows.forEach(row => row.forEach((txt, idx) => txt.length > widths[idx] && (widths[idx] = txt.length)));

  const _pad = (txt, idx) => pad(txt, widths[idx] + padding);

  const head = columns.map(_pad).join('');
  const body = rows.map(row => row.map(_pad).join('')).join('\n');
  const msg = head + '\n\n' + body;

  ctx.reply(msg, {
    entities: [{
      type: 'pre',
      offset: 0,
      length: msg.length
    }]
  });
}

function pad(txt, len) {
  return txt + Array(len - txt.length).fill(' ').join('');
}*/