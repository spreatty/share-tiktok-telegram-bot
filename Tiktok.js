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
  const tiktokLookupUrl = new URL(tiktokUrl);
  tiktokLookupUrl.search = '';
  
  console.log('Lookup URL: ' + tiktokLookupUrl);
  console.log('URL: ' + tiktokUrl);

  const cachedVideo = (await db.getVideoByUrl(tiktokLookupUrl.toString()))[0];
  if(cachedVideo) {
    const fileId = cachedVideo.file_id;
    console.log('Found in database. File id: ' + fileId);
    if(cachedVideo.slides) {
      targets.forEach(target => bot.telegram.sendMediaGroup(target, prepareSlides(cachedVideo.slides, extra)));
    } else {
      extra.width = cachedVideo.width;
      extra.height = cachedVideo.height;
      targets.forEach(target => bot.telegram.sendVideo(target, fileId, extra));
    }
    return;
  }

  new TiktokFetcher(tiktokUrl)
      .on('video', (videoStream, { width, height }, urls) => {
        videoExtra.width = width;
        videoExtra.height = height;
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
  db.putVideo(fileId, null, extra.width, extra.height);
  rest.forEach(target => bot.telegram.sendVideo(target, fileId, extra));
  urls.forEach(url => db.putUrlRecord(url.toString(), fileId));
}

async function sendAndSaveSlides([ first, ...rest ], slideStreams, extra, urls) {
  const response = await bot.telegram.sendMediaGroup(first, prepareSlides(slideStreams, extra, streamToPhoto));
  const files = response.map(msg => msg.photo.slice(-1)[0].file_id);
  const fileId = files[0];
  db.putVideo(fileId, files.join('||'));
  rest.forEach(target => bot.telegram.sendMediaGroup(target, prepareSlides(files, extra)));
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