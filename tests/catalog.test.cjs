const { test } = require('node:test');
const assert = require('node:assert/strict');
const { URL, load, validate } = require('../extension/catalog.js');

test('loads only the public catalogue, without credentials or caching', async () => {
  const ids = await load(async (url, options) => {
    assert.equal(url, URL);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.redirect, 'error');
    return Response.json({ version: 1, ids: ['one', 'two'] });
  });
  assert.deepEqual(ids, ['one', 'two']);
});

test('accepts an intentionally empty catalogue and rejects malformed or unavailable responses', async () => {
  assert.deepEqual(await load(async () => Response.json({ version: 1, ids: [] })), []);
  for (const result of [
    Response.json({ version: 2, ids: ['one'] }),
    Response.json({ version: 1, ids: ['../unsafe'] }),
    Response.json({ version: 1, ids: ['one', 'one'] }),
    Response.json({ version: 1, ids: 'one' }),
    new Response('<html>sign in</html>'),
    new Response(null, { status: 503 }),
  ]) await assert.rejects(load(async () => result), { code: 'CATALOG' });
  await assert.rejects(load(async () => { throw new Error('offline'); }), { code: 'CATALOG' });
});

test('caps the catalogue at 100 IDs', () => {
  assert.equal(validate(Array.from({length:100}, (_,i) => `id${i}`)).length,100);
  assert.throws(() => validate(Array.from({length:101}, (_,i) => `id${i}`)), /100/);
});
