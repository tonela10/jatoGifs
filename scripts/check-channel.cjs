// Read-only smoke test: fetch public IDs and check both GIF representations.
const { load, media } = require('../extension/catalog.js');

(async () => {
  const ids = await load();
  const missing = [];
  const isGif = async url => {
    const response = await fetch(url, {
      method: 'HEAD', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    return response.ok && /^image\/gif(?:;|$)/i.test(response.headers.get('content-type') || '');
  };
  for (const id of ids) {
    const { preview, url } = media(id);
    const [thumbnail, original] = await Promise.all([isGif(preview), isGif(url)]);
    if (!thumbnail || !original) missing.push(id);
  }
  console.log(JSON.stringify({ entries: ids.length, available: ids.length - missing.length, missing }));
  if (missing.length) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
