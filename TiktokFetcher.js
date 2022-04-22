const https = require('https');
const http2 = require('http2');
const EventEmitter = require('events');

const http2Hosts = [
  'm.tiktok.com',
  'www.tiktok.com'
];
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Safari/605.1.15',
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
    var data, appConfig;
    var actualUrl = this.#url;

    for(var i = 1; i <= retriesCount && !appConfig; ++i) {
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
      appConfig = parseAppConfig(data);
    }

    if(!appConfig) {
      this.emit('fail', data);
      return;
    }

    const moduleConfig = appConfig.ItemModule;
    if(!moduleConfig) {
      this.emit('fail', data);
      return;
    }

    const videoConfig = Object.values(moduleConfig)[0]?.video;
    if(!videoConfig) {
      this.emit('fail', data);
      return;
    }

    const videoUrl = videoConfig.playAddr;
    if(!videoUrl) {
      this.emit('fail', data);
      return;
    }

    console.log('Loading video ' + videoUrl);
    const videoStream = await httpsGet(new URL(videoUrl), { ...headers, Referer: videoUrl });
    this.emit('success', videoStream, videoConfig, stackUrl);
  }
};

function parseAppConfig(html) {
  var scriptContent = html.match(scriptTagRegex)?.[1];
  if(!scriptContent) {
    console.error("Couldn't find app config");
    return;
  }

  //var jsonSource = '{' + scriptContent.replace(/window\[['"](.*?)['"]\]\s*=/g, '"$1":').replace(/\};/g, '},') + '}';
  var jsonSource = scriptContent;
  try {
    return JSON.parse(jsonSource);
  } catch(error) {
    console.error("Couldn't parse app config");
    console.error(jsonSource);
  }
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
