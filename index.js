const fastify = require('fastify');
const { Telegraf } = require('telegraf');
const { isTiktokUrl, onTiktok } = require('./Tiktok');
const UserBot = require('./UserBot');
const AdminBot = require('./AdminBot');
const db = require('./db');

const app = fastify();
const bot = global.bot = new Telegraf(process.env.BOT_TOKEN);

const domain = process.env.PROJECT_DOMAIN ? process.env.PROJECT_DOMAIN + '.glitch.me' : 'completely-wrong-domain.glitch.me';
const port = process.env.PORT || 8080;
const path = '/telegraf/' + bot.secretPathComponent();

app.get('/', (req, res) => {
  res.code(200).send("It's a bot");
});

process.on('breforeExit', () => {
  console.log('Exiting');
  db.close();
  process.exit(0);
});

UserBot.addHandlers();
AdminBot.addHandlers();

bot.url(isTiktokUrl, onTiktok);

const webhook = bot.webhookCallback(path);
app.all(path, (req, res) => webhook(req.raw, res.raw));

db.connect()
  .then(db.createSchema)
  .then(() => app.listen({ port }, () => console.log(`Serving https://${domain}${path} on ${port}`)))
  .then(() => bot.telegram.setWebhook('https://' + domain + path));
