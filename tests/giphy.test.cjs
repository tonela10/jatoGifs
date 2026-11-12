const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchPage, fetchByIds } = require('../extension/giphy.js');
const item = (id = 'one', username = 'tonela10') => ({ id, title: id, username, images: { original: { url: `https://media.giphy.com/${id}/giphy.gif?cid=keep` }, fixed_width: { url: `https://media.giphy.com/${id}/200w.gif?rid=keep` } } });
const response = data => ({ ok: true, json: async () => ({ data, meta: { status: 200, response_id: 'test-response' } }) });

test('requests only selected IDs directly, without search, cookies or response caching', async () => {
  const result = await fetchByIds('test-app-key', ['one','two'], async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.giphy.com'); assert.equal(parsed.pathname, '/v1/gifs');
    assert.equal(parsed.searchParams.get('ids'), 'one,two'); assert.equal(parsed.searchParams.has('q'), false);
    assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store'); assert.equal(init.referrerPolicy, 'no-referrer');
    return response([item('two'), item('one')]);
  });
  assert.deepEqual(result.items.map(x => x.id), ['two','one']);
  assert.equal(result.items[0].url, 'https://media.giphy.com/two/giphy.gif?cid=keep');
  assert.deepEqual(result.missingIds, []);
});
test('reports removed GIFs and advances through requested IDs even when a page is empty', async () => {
  const ids = Array.from({length:27}, (_,i)=>String(i+1));
  const first = await fetchPage('key',0,async()=>response([]),ids);
  assert.equal(first.items.length,0); assert.equal(first.missingIds.length,25);
  assert.equal(first.nextOffset,25); assert.equal(first.hasMore,true);
  const next = await fetchPage('key',25,async url=> {
    assert.equal(new URL(url).searchParams.get('ids'),'26,27'); return response([item('26'),item('27')]);
  },ids);
  assert.equal(next.nextOffset,27); assert.equal(next.hasMore,false);
});
test('an explicitly empty collection does not make a network request', async () => {
  assert.deepEqual(await fetchPage('',0,()=>{throw Error('must not request');},[]), {items:[],missingIds:[],nextOffset:0,hasMore:false});
});
test('rejects missing key, malformed IDs and invalid offsets before requesting', async () => {
  const never=()=>{throw Error('must not request');};
  await assert.rejects(fetchByIds('', ['one'], never), {code:'NOT_CONFIGURED'});
  for (const ids of [['one','one'],['../bad'],new Array(101).fill('one'),'one']) await assert.rejects(fetchByIds('key',ids,never),{code:'IDS'});
  for (const offset of [-1,1.5,'25',5000]) await assert.rejects(fetchPage('key',offset,never,['one']),{code:'OFFSET'});
});
test('handles invalid key, rate limit, service failure and offline', async () => {
  for (const [status,code] of [[401,'KEY'],[403,'KEY'],[429,'RATE_LIMIT'],[503,'SERVICE']]) await assert.rejects(fetchByIds('key',['one'],async()=>({ok:false,status})),{code});
  await assert.rejects(fetchByIds('key',['one'],async()=>{throw Error('offline');}),{code:'NETWORK'});
});
test('rejects synthetic success and malformed JSON', async () => {
  await assert.rejects(fetchByIds('key',['one'],async()=>({ok:true,json:async()=>({meta:{status:200,response_id:''},data:[]})})),{code:'SERVICE'});
  await assert.rejects(fetchByIds('key',['one'],async()=>({ok:true,json:async()=>{throw Error('invalid');}})),{code:'SERVICE'});
});
test('rejects unexpected IDs, duplicate results and unsafe media', async () => {
  await assert.rejects(fetchByIds('key',['one'],async()=>response([item('other')])),{code:'SERVICE'});
  await assert.rejects(fetchByIds('key',['one'],async()=>response([item(),item()])),{code:'SERVICE'});
  const unsafe=item(); unsafe.images.original.url='https://evil.test/a.gif';
  await assert.rejects(fetchByIds('key',['one'],async()=>response([unsafe])),{code:'SERVICE'});
});
test('accepts any author only when the ID is in the requested catalogue', async () => {
  const chosen = { ...item('curated', 'another-author'), title: '' };
  const result = await fetchByIds('key', ['one', 'curated'], async () => response([item(), chosen]));
  assert.equal(result.items[1].title, 'GIF de GIPHY');
  assert.equal(result.items[1].username, 'another-author');
  await assert.rejects(fetchByIds('key', ['one'], async () => response([chosen])), {code:'SERVICE'});
});
