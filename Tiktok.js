const TiktokFetcher = require('./TiktokFetcher');
const props = require('./props');
const db = require('./db');

module.exports = {
  isTiktokUrl,
  onTiktok
};

function isTiktokUrl(url) {
  const host = new URL(url).hostname;
  return host == 'tiktok.com' || host.endsWith('.tiktok.com');
}

async function onTiktok({ update }) {
  const source = update.message.chat.id.toString();
  const rows = await db.getLinks(source);
  if(!rows.length)
    return;
  
  const targets = rows.map(row => row.target);

  const tiktokUrl = update.message.entities
      .filter(({ type }) => type == 'url')
      .map(({ offset, length }) => update.message.text.slice(offset, offset + length))
      .find(isTiktokUrl);
  
  console.log('URL: ' + tiktokUrl);

  new TiktokFetcher(tiktokUrl)
      .on('success', (videoStream, { width, height }) => {
        broadcast(targets,
            target => bot.telegram.sendVideo(target, { source: videoStream }, { width, height }),
            (target, fileId) => bot.telegram.sendVideo(target, fileId));
      })
      .on('fail', data => {
        console.log('Failed to retrieve the video. Forwarding original message and sending received html');
        const forwardMsg = () => bot.telegram.sendMessage(target, update.message.text, props.noPreview);

        broadcast(targets,
          target => forwardMsg().then(() =>
              bot.telegram.sendDocument(target, { source: Buffer.from(data), filename: 'tiktok.html' })),
          (target, fileId) => forwardMsg().then(() =>
              bot.telegram.sendDocument(target, fileId)));
      })
      .fetch();
}

async function broadcast(targets, sendFirst, sendKnown) {
  const [ first, ...rest ] = targets;
  const res = await sendFirst(first);
  const fileId = res.video ? res.video.file_id : res.document.file_id;
  console.log('Generated file id ' + fileId);
  rest.forEach(target => sendKnown(target, fileId));
}