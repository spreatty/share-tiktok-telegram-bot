const https = require('https');
const http2 = require('http2');
const EventEmitter = require('events');

const http2Hosts = ['m.tiktok.com', 'www.tiktok.com'];
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'
};
const videoConfigRegex = /"video":(\{.*?\})/g;
const urlKey = 'playAddr';
const retriesCount = 3;

module.exports = class TiktokFetcher extends EventEmitter {
  #url;

  constructor(url) {
    super();
    this.#url = url;
  }

  async fetch() {
    var stackUrl, data, videoConfigRaw;
    var actualUrl = this.#url;

    for(var i = 1; i <= retriesCount && !videoConfigRaw; ++i) {
      console.log(`Attempt #${i} ${actualUrl}`);
      const response = await httpGet(actualUrl, commonHeaders, true);
      data = response.data;
      if(!stackUrl) {
        stackUrl = response.stackUrl;
        actualUrl = stackUrl[0];
      }
      videoConfigRaw = data.match(videoConfigRegex)?.find(match => match.includes(urlKey));
    }

    if(!videoConfigRaw) {
      this.emit('fail', data);
      return;
    }

    const videoConfig = parseVideoConfig(videoConfigRaw);
    if(!videoConfig) {
      this.emit('fail', data);
      return;
    }

    const videoUrl = new URL(videoConfig[urlKey]);
    console.log('Loading video ' + videoUrl);
    const videoStream = await httpsGet(videoUrl, { ...commonHeaders, Referer: videoUrl });
    this.emit('success', videoStream, videoConfig, stackUrl);
  }
};

function parseVideoConfig(rawConfig) {
  try {
    return JSON.parse('{' + rawConfig + '}').video;
  } catch(error) {
    console.error("Couldn't parse video config");
    console.error(rawConfig);
  }
}

async function httpGet(url, headers, stripSearchParams) {
  url = new URL(url);
  if(stripSearchParams)
    url.search = '';
  const method = http2Hosts.includes(url.hostname) ? http2Get : httpsGet;
  const response = await method(url, headers);
  const redirect = response.headers.location;
  if(redirect) {
    console.log('Redirect to ' + redirect);
    response.close();
    const result = await httpGet(redirect, headers, stripSearchParams);
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
            this.request({ ':path': url.pathname, ...headers })
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
