import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { createWorker } from '../cloudflare/worker.mjs';
import { isAdmin } from '../cloudflare/access.mjs';

const site = 'https://jato.sediles.dev';
const seed = readFileSync(new URL('../cloudflare/migrations/0001_catalog.sql', import.meta.url), 'utf8');

function db() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(seed);
  return { prepare(query) {
    const stmt = sql.prepare(query);
    return { bind: (...args) => ({
      all: async () => ({ results: stmt.all(...args) }),
      run: async () => ({ meta: stmt.run(...args) }),
    }) };
  } };
}

const get = (path = '/api/catalog') => new Request(site + path);
const post = (gif, action = 'add', origin = site, path = '/admin') => new Request(site + path, {
  method: 'POST', headers: { Origin: origin }, body: new URLSearchParams({ gif, action }),
});

test('public catalogue exposes only nine seeded IDs; public writes and direct admin bypass fail', async () => {
  const env = { CATALOG_DB: db() };
  const res = await worker.fetch(get(), env);
  const data = await res.json();
  assert.deepEqual(Object.keys(data), ['version', 'ids']);
  assert.equal(data.ids.length, 9);
  assert.ok(data.ids.includes('o5usW6VUC2TkUrC42m'));
  assert.equal((await worker.fetch(get('/admin'), env)).status, 403);
  assert.equal((await worker.fetch(post('unauthorized'), env)).status, 403);
  assert.equal((await worker.fetch(post('unauthorized', 'add', site, '/api/catalog'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://some-worker.workers.dev/admin'), env)).status, 404);
});

test('authenticated edits are validated, persisted, and immediately reflected by the public route', async () => {
  const app = createWorker(async () => true);
  const env = { CATALOG_DB: db() };
  assert.equal((await app.fetch(post('https://giphy.com/gifs/test-sampleId', 'add', 'https://attacker.invalid'), env)).status, 403);
  assert.equal((await app.fetch(post('https://attacker.invalid/gifs/sampleId'), env)).status, 400);
  assert.equal((await app.fetch(post('https://giphy.com/gifs/test-sampleId'), env)).status, 303);
  assert.equal((await app.fetch(post('sampleId'), env)).status, 409);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.at(-1), 'sampleId');
  assert.equal((await app.fetch(post('sampleId', 'remove'), env)).status, 303);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.includes('sampleId'), false);
  assert.equal((await app.fetch(post('a'.repeat(2500)), env)).status, 413);
  for (let i = 0; i < 91; i++) assert.equal((await app.fetch(post(`test${i}`), env)).status, 303);
  assert.equal((await app.fetch(post('overLimit'), env)).status, 409);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.length, 100);
});

test('admin JWT requires valid RS256 signature, issuer, audience, expiration and owner email', async () => {
  const env = { ACCESS_ISSUER:'https://team.cloudflareaccess.com', ACCESS_AUD:'my-app', ADMIN_EMAIL:'owner@example.test' };
  const algorithm = { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256', modulusLength:2048, publicExponent:Uint8Array.of(1,0,1) };
  const keys = await crypto.subtle.generateKey(algorithm, true, ['sign','verify']);
  const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid:'test-key' };
  const fetcher = async url => {
    assert.equal(url, env.ACCESS_ISSUER + '/cdn-cgi/access/certs');
    return Response.json({ keys:[jwk] });
  };
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  const head = encode({ alg:'RS256', kid:jwk.kid });
  const now = Math.floor(Date.now()/1000);
  const claims = { iss:env.ACCESS_ISSUER, aud:[env.ACCESS_AUD], type:'app', exp:now+300, nbf:now-1, email:env.ADMIN_EMAIL };
  const req = token => new Request(site+'/admin', { headers:{ 'Cf-Access-Jwt-Assertion':token } });
  const sign = async payload => {
    const body = head+'.'+encode(payload);
    const sig = await crypto.subtle.sign(algorithm.name, keys.privateKey, new TextEncoder().encode(body));
    return body+'.'+Buffer.from(sig).toString('base64url');
  };
  assert.equal(await isAdmin(req(await sign(claims)), env, fetcher), true);
  for (const edit of [{ aud:['another-app'] }, { email:'someone@example.test' }, { exp:now-1 }, { iss:'https://attacker.invalid' }, { type:'org' }]) {
    assert.equal(await isAdmin(req(await sign({...claims,...edit})), env, fetcher), false);
  }
  const valid = await sign(claims);
  assert.equal(await isAdmin(req(valid.split('.').slice(0,2).join('.')+'.AAAA'), env, fetcher), false);
  assert.equal(await isAdmin(req('forged'), env, fetcher), false);
});
