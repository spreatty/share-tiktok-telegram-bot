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
  const source = update.message.chat.id;
  const targets = await db.getTargets(source);
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
      .on('video', async (videoStream, { width, height }) => {
        extra.width = width;
        extra.height = height;
        try {
          await sendVideo(targets, videoStream, extra);
        } catch(error) {
          sendMessage(targets, (error.code == 413 ? text.error.tooLarge : text.error.unknown) + '\n\n' + update.message.text);
        }
      })
      .on('slides', slideStreams => {
        sendSlides(targets, slideStreams, extra);
      })
      .on('fail', data => {
        console.log('Failed to retrieve the video. Forwarding original message and sending received html');
        sendDocument(targets, text.error.unknown + '\n\n' + update.message.text, { source: Buffer.from(data), filename: 'debug.html' });
      })
      .on('blocked', () => {
        bot.telegram.sendMessage(source, text.blocked);
      })
      .on('invalid', () => {
        bot.telegram.sendMessage(source, text.invalid);
      })
      .fetch();
}

async function sendVideo([ first, ...rest ], videoStream, extra) {
  const response = await bot.telegram.sendVideo(first, {source: videoStream}, extra);
  const fileId = response.video.file_id;
  rest.forEach(target => bot.telegram.sendVideo(target, fileId, extra));
}

async function sendSlides([ first, ...rest ], slideStreams, extra) {
  const response = await bot.telegram.sendMediaGroup(first, prepareSlides(slideStreams, extra, streamToPhoto));
  const files = response.map(msg => msg.photo.slice(-1)[0].file_id);
  rest.forEach(target => bot.telegram.sendMediaGroup(target, prepareSlides(files, extra)));
}

async function sendMessage(targets, message) {
  targets.forEach(target => {
    bot.telegram.sendMessage(target, message, props.noPreview);
  });
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