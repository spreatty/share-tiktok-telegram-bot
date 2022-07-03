const https = require('https');
const http2 = require('http2');
const EventEmitter = require('events');
const { JSDOM } = require('jsdom');

const http2Hosts = [
  'm.tiktok.com',
  'www.tiktok.com'
];
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-gb',
  'Accept-Encoding': 'identity'
};
const scriptTagRegex = /<script\s+id\s*=\s*"SIGI_STATE"[^>]*>(.*?)<\/script>/i;
const retriesCount = 3;

module.exports = class TiktokFetcher extends EventEmitter {
  #url;

  constructor(url) {
    super();
    this.#url = url;
  }

  async fetch() {
    const stackUrl = new Set();
    const headers = { ...commonHeaders };
    var data, appState;
    var actualUrl = this.#url;

    for(var i = 1; i <= retriesCount && !appState; ++i) {
      if(i > 1)
        await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`Attempt #${i} ${actualUrl}`);
      const response = await httpGet(actualUrl, headers, true);
      data = response.data;
      const newUrl = response.stackUrl[0].toString();
      if(actualUrl != newUrl) {
        actualUrl = newUrl;
        i = 0;
      }
      response.stackUrl.forEach(url => {
        const urlNoSearch = new URL(url);
        urlNoSearch.search = '';
        stackUrl.add(urlNoSearch.toString());
      });
      appState = parseHtml(data);
    }

    if(!appState) {
      this.emit('fail', data);
      return;
    }

    if(appState.slides.length) {
      const slideStreams = await Promise.all(appState.slides.map(url => {
        console.log('Loading slide ' + url);
        return httpsGet(new URL(url), { ...headers, Referer: url });
      }));
      this.emit('slides', slideStreams, stackUrl);
    } else {
      //const videoConfig = Object.values(appState.appConfig.ItemModule)[0].video;
      const videoUrl = appState.video; //videoConfig.playAddr;
      console.log('Loading video ' + videoUrl);
      const videoStream = await httpsGet(new URL(videoUrl), { ...headers, Referer: videoUrl });
      this.emit('video', videoStream, stackUrl);
    }
  }
};

function parseHtml(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const video = doc.querySelector('video#sharing-main-video-el')?.src;
  const slides = Array.from(doc.querySelectorAll('div.swiper-slide:not(.swiper-slide-duplicate) img')).map(img => img.src);

  return !video && !slides.length ? null : { video, slides };
}

async function httpGet(url, headers) {
  url = new URL(url);
  const method = http2Hosts.includes(url.hostname) ? http2Get : httpsGet;
  const response = await method(url, headers);
  if(response.headers['set-cookie']) {
    headers.cookie = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    console.log('Set cookie: ' + headers.cookie);
  }
  const redirect = response.headers.location;
  if(redirect) {
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
          })
          .end());
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
            })
                .on('error', err => {
                  reject(err);
                  close();
                })
                .on('response', function(headers) {
                  this.close = close;
                  this.headers = headers;
                  this.on('end', close);
                  resolve(this);
                })
                .end();
          }));
}
