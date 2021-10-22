const TiktokFetcher = require('./TiktokFetcher');
const Util = require('./Util');
const text = require('./text');
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
  const targets = (await db.getTargets(source)).map(row => row.target);
  if(!targets.length)
    return;

  const from = Util.getFullName(update.message.from);
  const videoExtra = {
    caption: text.from + from,
    caption_entities: [{ type: 'bold', offset: text.from.length, length: from.length }]
  };

  const tiktokUrl = new URL(Util.getUrls(update.message.entities, update.message.text).find(isTiktokUrl));
  const tiktokLookupUrl = new URL(tiktokUrl);
  tiktokLookupUrl.search = '';
  
  console.log('Lookup URL: ' + tiktokLookupUrl);
  console.log('URL: ' + tiktokUrl);


  const cachedVideo = (await db.getVideoByUrl(tiktokLookupUrl.toString()))[0];
  if(cachedVideo) {
    videoExtra.width = cachedVideo.width;
    videoExtra.height = cachedVideo.height;
    const fileId = cachedVideo.file_id;
    console.log('Found in database. File id: ' + fileId);
    targets.forEach(target => bot.telegram.sendVideo(target, fileId, videoExtra));
    return;
  }

  new TiktokFetcher(tiktokUrl)
      .on('success', (videoStream, { width, height }, urls) => {
        videoExtra.width = width;
        videoExtra.height = height;
        sendAndSaveVideo(targets, { source: videoStream }, videoExtra, urls);
      })
      .on('fail', data => {
        console.log('Failed to retrieve the video. Forwarding original message and sending received html');
        sendDocument(targets, update.message.text, { source: Buffer.from(data), filename: 'tiktok.html' });
      })
      .fetch();
}

async function sendAndSaveVideo([ first, ...rest ], videoData, videoExtra, urls) {
  const response = await bot.telegram.sendVideo(first, videoData, videoExtra);
  const fileId = response.video.file_id;
  db.putVideo(fileId, videoExtra.width, videoExtra.height);
  rest.forEach(target => bot.telegram.sendVideo(target, fileId, videoExtra));
  urls.forEach(url => db.putUrlRecord(url.toString(), fileId));
}

async function sendDocument([ first, ...rest ], originalText, docData) {
  await bot.telegram.sendMessage(first, originalText, props.noPreview);
  const response = await bot.telegram.sendDocument(first, docData);
  const fileId = response.document.file_id;
  rest.forEach(async target => {
    await bot.telegram.sendMessage(target, originalText, props.noPreview);
    bot.telegram.sendDocument(target, fileId);
  });
}