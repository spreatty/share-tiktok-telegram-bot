const vm = require('vm');
const util = require('util');

module.exports = {
  addHandlers() {
    bot.command('exec', exec);
  }
};

async function exec(ctx) {
  if(ctx.update.message.chat.username != 'spreatty')
    return;

  console.log(util.inspect(ctx.update, false, 10));

  const code = ctx.update.message.text.slice('/exec '.length);
  const res = await vm.runInThisContext(code);
  if(res)
    ctx.reply('' + res);
}