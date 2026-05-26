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

  client.get(url, options, (stream) => {

    // 🔁 FOLLOW REDIRECT
    if (stream.statusCode >= 300 && stream.statusCode < 400 && stream.headers.location) {
      console.log("Redirect to:", stream.headers.location);
      return getStream(stream.headers.location, res);
    }

  const headers = { ...stream.headers };

  // 🔥 evita doppio header CORS
  if (!headers['access-control-allow-origin']) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  res.writeHead(stream.statusCode, headers);

    stream.pipe(res);

  }).on('error', (err) => {
    console.error("Proxy error:", err);
    res.writeHead(500);
    res.end('Stream error');
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