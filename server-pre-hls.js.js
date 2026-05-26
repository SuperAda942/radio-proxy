const http = require('http');
const https = require('https');

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

http.createServer((req, res) => {

  const urlObj = new URL(req.url, 'http://localhost');
  const streamUrl = urlObj.searchParams.get('url');

  if (!streamUrl) {
    res.writeHead(400);
    return res.end('Missing url');
  }

  console.log("Proxying:", streamUrl);

  getStream(streamUrl, res);

}).listen(3000, () => {
  console.log("Proxy running on http://localhost:3000");
});