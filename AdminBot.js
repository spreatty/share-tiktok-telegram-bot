const util = require('util');

module.exports = {
  addHandlers() {
    bot.command('exec', exec);
  }
};

function exec(ctx) {
  console.log(util.inspect(ctx.update, false, 10));
  const js = ctx.update.message.text.slice('/exec '.length);
}