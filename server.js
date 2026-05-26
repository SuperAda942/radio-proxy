
const http = require('http');
const https = require('https');
const express = require('express');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  next();
});

function getStream(url, res) {

  const client = url.startsWith('https') ? https : http;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Icy-MetaData': '0',
      'Accept': '*/*',
      'Connection': 'keep-alive'
    }
  };

  const request = client.get(url, options, (stream) => {
  
    stream.setTimeout(30000);

    /*
    stream.on('timeout', () => {
      console.log("STREAM TIMEOUT");
      stream.destroy();
    });
    */

    // 🔁 FOLLOW REDIRECT
    if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
      console.log("Redirect to:", stream.headers.location);
      return getStream(stream.headers.location, res);
    }

  const headers = { ...stream.headers };

  delete headers['content-length'];
  delete headers['transfer-encoding'];
  delete headers['content-encoding'];

  // 🔥 forza un solo header CORS
  delete headers['access-control-allow-origin'];

  headers['access-control-allow-origin'] = '*';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');

  res.writeHead(stream.statusCode || 200, {
    'Content-Type': stream.headers['content-type'] || 'audio/mpeg',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  stream.on('close', () => {
    console.log("STREAM CLOSED");
  });

  stream.on('end', () => {
    console.log("STREAM ENDED");
  });

  stream.pipe(res);

  }).on('error', (err) => {
    console.error("Proxy error:", err);
    res.writeHead(500);
    res.end('Stream error');
  });

  request.setTimeout(10000, () => {
  console.log("REQUEST TIMEOUT");
  request.destroy();
  });
}

app.get('/', (req, res) => {

  const streamUrl = req.query.url;

  if (!streamUrl) {
    res.status(400).send('Missing url');
    return;
  }

  console.log("Proxying:", streamUrl);

  getStream(streamUrl, res);

});

app.get('/hls', async (req, res) => {

const streamUrl = req.query.url;

if (!streamUrl) {
    return res.status(400).send('Missing url');
}

console.log("HLS REQUEST:", streamUrl);

res.setHeader('Access-Control-Allow-Origin', '*');

try {

    const client = streamUrl.startsWith('https')
        ? https
        : http;

    client.get(streamUrl, (response) => {

        const contentType =
            response.headers['content-type'] || '';
        
        const isManifest =
            streamUrl.includes('.m3u8') ||
            contentType.includes('mpegurl') ||
            contentType.includes('application/vnd.apple.mpegurl');

  if (!isManifest) {

      res.writeHead(200, {
          'Content-Type':
              response.headers['content-type']
              || 'audio/mpeg',

          'Access-Control-Allow-Origin': '*',

          'Cache-Control': 'no-cache'
      });

      response.pipe(res);

      return;
  }

  let data = '';

  response.on('data', chunk => {
      data += chunk;
  });

  response.on('end', () => {

      const baseUrl =
          streamUrl.substring(
              0,
              streamUrl.lastIndexOf('/') + 1
          );

      data = data.replace(
          /^([^#].*\.m3u8.*)$/gm,
          (match) => {

              const absoluteUrl =
                  new URL(match, baseUrl).href;

              return 'https://radio-proxy-e7an.onrender.com/hls?url=' +
                  encodeURIComponent(absoluteUrl);

          }
      );

      data = data.replace(
          /^([^#].*\.(ts|aac|mp3).*)$/gm,
          (match) => {

              const absoluteUrl =
                  new URL(match, baseUrl).href;

              return 'https://radio-proxy-e7an.onrender.com/hls?url=' +
                  encodeURIComponent(absoluteUrl);

          }
      );

      res.setHeader(
          'Content-Type',
          'application/vnd.apple.mpegurl'
      );

      res.send(data);

  });

    }).on('error', (err) => {

        console.log("HLS ERROR:", err);

        res.status(500).send('HLS fetch error');

    });

} catch (e) {

    console.log("HLS CATCH:", e);

    res.status(500).send('HLS catch error');

}

});

app.listen(3000, () => {
  console.log("Proxy running on port 3000");
});
