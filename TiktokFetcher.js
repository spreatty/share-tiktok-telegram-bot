const https = require('https');
const http2 = require('http2');
const EventEmitter = require('events');
const { JSDOM } = require('jsdom');
const Util = require('./Util');

const http2Hosts = [
  'm.tiktok.com',
  'www.tiktok.com'
];
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-gb',
  'Accept-Encoding': 'identity'
};
const mobileUserAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36';
const retriesCount = 3;

module.exports = class TiktokFetcher extends EventEmitter {
  #url;

  constructor(url) {
    super();
    this.#url = url;
  }

  async fetch() {
    const headers = { ...commonHeaders };
    var data, displayItem;
    var actualUrl = this.#url;

    for(var i = 1; i <= retriesCount; ++i) {
      if(i > 1)
        await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`Attempt #${i} ${actualUrl}`);
      const response = await httpGet(actualUrl, headers);
      data = response.data;
      const newUrl = response.stackUrl[0];

      if(newUrl.host == 'www.tiktok.com' && newUrl.pathname == '/') {
        this.emit(newUrl.searchParams.has('_t') && newUrl.searchParams.has('_r') ? 'blocked' : 'invalid');
        return;
      }

      if(actualUrl != newUrl.toString()) {
        actualUrl = newUrl.toString();
        i = 1;
      }
      
      const appConfig = parseAppConfig(data);
      displayItem = getDisplayItem(appConfig);
      if(displayItem)
        break;
    }

    try {
      if(!displayItem) {
        console.warn('Could not get video data');
        this.emit('fail', data);
        return;
      }

      const videoConfig = displayItem.video;
      const videoUrl = videoConfig?.playAddr;
      if(videoUrl) {
        console.log('Loading video ' + videoUrl);
        const videoStream = await httpsGet(new URL(videoUrl), { ...headers, Referer: videoUrl });
        this.emit('video', videoStream, videoConfig);
        return;
      }

      const slides = displayItem.imagePost.images.map(img => img.imageURL.urlList[0]);
      console.log('Slides:\n  ' + slides.join('\n  '));
      const slideStreams = await Promise.all(slides.map(url => {
        console.log('Loading slide ' + url);
        return httpsGet(new URL(url), { ...headers, Referer: url });
      }));
      this.emit('slides', slideStreams);
    } catch(e) {
      console.error(e);
      this.emit('fail', data);
    }
  }
};

function getDisplayItem(appConfig) {
  const path = Util.searchJSONTree(appConfig, 'playAddr')[0];
  if(!path) {
    console.warn('No item config');
    return null;
  }
  const videoParent = path[path.length - 3][1];
  return videoParent;
}

function parseAppConfig(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const appConfigScript = Array.from(doc.querySelectorAll('script[type="application/json"]'))
    .filter(s => s.innerHTML.includes('playAddr'))[0];
  if(!appConfigScript) {
    console.warn("Couldn't find app config");
    return;
  }

  return JSON.parse(appConfigScript.innerHTML);
}

function parseSlides(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  return Array.from(doc.querySelectorAll('div.swiper-slide:not(.swiper-slide-duplicate) img')).map(img => img.src);
}

async function httpGet(url, headers) {
  url = new URL(url);
  const method = http2Hosts.includes(url.hostname) ? http2Get : httpsGet;
  const response = await method(url, headers);
  if(response.headers['set-cookie']) {
    headers.cookie = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    console.log('Set cookie: ' + headers.cookie);
  }
  var redirect = response.headers.location;
  if(redirect) {
    redirect = new URL(redirect, url);
    console.log('Redirect to ' + redirect);
    response.close();
    const result = await httpGet(redirect, headers);
    result.stackUrl.push(url);
    return result;
  } else {
    console.log('Retrieving data');
    const data = await readHttpStream(response);
    return { data, stackUrl: [url] };
  }
}

function readHttpStream(response) {
  return new Promise(resolve => {
    response.setEncoding('utf8');
    var data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => resolve(data));
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) =>
      https.get(url, { headers })
          .on('error', reject)
          .on('response', function(res) {
            res.close = () => this.destroy();
            resolve(res);
          }).end());
}

function http2Get(url, headers) {
  return new Promise((resolve, reject) =>
      http2.connect(url)
          .on('error', reject)
          .on('connect', function() {
            const close = () => this.close();
            this.request({
              ':method': 'GET',
              ':scheme': 'https',
              ':authority': url.hostname,
              ':path': url.pathname + url.search,
              ...headers
            }).on('error', err => {
              reject(err);
              close();
            }).on('response', function(headers) {
              this.close = close;
              this.headers = headers;
              this.on('end', close);
              resolve(this);
            }).end();
          }));
}
