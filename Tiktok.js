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
  const extra = {
    caption: text.from + from,
    caption_entities: [{ type: 'bold', offset: text.from.length, length: from.length }]
  };

  const tiktokUrl = Util.getUrls(update.message.entities, update.message.text).find(isTiktokUrl);
  console.log('URL: ' + tiktokUrl);

  new TiktokFetcher(tiktokUrl)
      .on('video', (videoStream, { width, height }, urls) => {
        extra.width = width;
        extra.height = height;
        sendAndSaveVideo(targets, videoStream, extra, urls);
      })
      .on('slides', (slideStreams, urls) => {
        sendAndSaveSlides(targets, slideStreams, extra, urls);
      })
      .on('fail', data => {
        console.log('Failed to retrieve the video. Forwarding original message and sending received html');
        sendDocument(targets, update.message.text, { source: Buffer.from(data), filename: 'tiktok.html' });
      })
      .fetch();
}

async function sendAndSaveVideo([ first, ...rest ], videoStream, extra, urls) {
  const response = await bot.telegram.sendVideo(first, {source: videoStream}, extra);
  const fileId = response.video.file_id;
  rest.forEach(target => bot.telegram.sendVideo(target, fileId, extra));
}

async function sendAndSaveSlides([ first, ...rest ], slideStreams, extra, urls) {
  const response = await bot.telegram.sendMediaGroup(first, prepareSlides(slideStreams, extra, streamToPhoto));
  const files = response.map(msg => msg.photo.slice(-1)[0].file_id);
  rest.forEach(target => bot.telegram.sendMediaGroup(target, prepareSlides(files, extra)));
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

function prepareSlides(slides, extra, converter = toPhoto) {
  var slidesData = slides.map(converter);
  Object.assign(slidesData[0], extra);
  return slidesData;
}

function streamToPhoto(stream) {
  return toPhoto({source: stream});
}

function toPhoto(media) {
  return {
    type: 'photo',
    media
  };
}