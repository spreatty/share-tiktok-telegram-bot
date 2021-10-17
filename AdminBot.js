const vm = require('vm');
const util = require('util');
const db = require('./db');

module.exports = {
  addHandlers() {
    bot.command('exec', exec);
    bot.command('sql', sql);
  }
};

function accessCheck(ctx) {
  if(ctx.update.message.chat.username != 'spreatty')
    throw new Error('Admin access denied for ' + ctx.update.message.chat.username);
}

async function exec(ctx) {
  accessCheck(ctx);

  console.log(util.inspect(ctx.update, false, 10));

  const code = ctx.update.message.text.slice('/exec '.length);
  vm.runInNewContext(code, { bot, ctx });
}

async function sql(ctx) {
  accessCheck(ctx);

  const sql = ctx.update.message.text.slice('/sql '.length);
  const result = await db.query(sql);
  if(!result.rows) {
    ctx.reply('Error');
    console.log(util.inspect(result, false, 10));
    return;
  }

  if(!result.rows.length) {
    ctx.reply('Empty response');
    return;
  }

  const padding = 2;
  var columns = Object.keys(result.rows[0]);
  var rows = result.rows.slice(0, 10);
  var widths = columns.map(txt => txt.length);
  rows.forEach(row => {
    Object.values(row).forEach((txt, idx) => {
      if(txt.length > widths[idx])
        widths[idx] = txt.length;
    });
  });

  const _pad = (txt, idx) => pad(txt, widths[idx] + padding);

  const head = columns.map(_pad).join('');
  const body = rows.map(row => Object.values(row).map(_pad).join('')).join('\n');
  const msg = head + '\n' + body;

  ctx.reply(msg, {
    entities: [{
      type: 'pre',
      offset: 0,
      length: msg.length
    }]
  });
}

function pad(txt, len) {
  return Array(len - txt.length).fill(' ').join('');
}