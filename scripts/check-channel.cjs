// Read-only live check. No API response, media or URL catalogue is written to disk.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { fetchPage } = require('../extension/giphy.js');
const config = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/config.js'), 'utf8'), config);
const expected = new Set(require('../extension/catalog.js').DEFAULT_IDS);
(async () => {
  const page = await fetchPage(process.env.GIPHY_API_KEY || config.self.JATO_CONFIG.apiKey);
  const matches = page.items.filter(gif => expected.has(gif.id)).length;
  console.log(JSON.stringify({ count:page.items.length, matchesExpectedGifs:matches, expected:expected.size, missingIds:page.missingIds, hasMore:page.hasMore, status:matches === expected.size ? 'API_RETURNS_ALL_GIFS' : 'COLLECTION_INCOMPLETE' },null,2));
  if (page.items.length !== expected.size || page.missingIds.length) process.exitCode = 2;
})().catch(error => { console.error(JSON.stringify({ status:'FAILED', code:error.code, message:error.message })); process.exitCode=1; });
