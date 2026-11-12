import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { createWorker, verifyGif } from '../cloudflare/worker.mjs';
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
const post = (gif, { path = '/', action, origin = site } = {}) => new Request(site + path, {
  method: 'POST',
  headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.5' },
  body: new URLSearchParams(action ? { gif, action } : { gif }),
});
const allow = { limit: async () => ({success:true}) };

test('the website and catalogue are public; the owner route and API writes are protected', async () => {
  const env = { CATALOG_DB: db() };
  const data = await (await worker.fetch(get(), env)).json();
  assert.deepEqual(Object.keys(data), ['version', 'ids']);
  assert.equal(data.ids.length, 9);
  const home = await worker.fetch(get('/'), env);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('Referrer-Policy'), 'same-origin');
  assert.match(await home.text(), /Añadir GIF/);
  const old = await worker.fetch(get('/admin'), env);
  assert.equal(old.headers.get('Location'), '/');
  assert.equal((await worker.fetch(get('/manage'), env)).status, 403);
  assert.equal((await worker.fetch(post('o5usW6VUC2TkUrC42m', { path:'/manage', action:'remove' }), env)).status, 403);
  assert.equal((await worker.fetch(post('unauthorized', { path:'/api/catalog' }), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://some-worker.workers.dev/'), env)).status, 404);
});

test('public additions verify GIPHY, deduplicate and update the same catalogue; only the owner can remove', async () => {
  const app = createWorker({ checkAdmin:async () => true, checkGif:async id => id !== 'notFound' });
  const env = { CATALOG_DB: db(), ADD_RATE_LIMIT: allow };
  assert.equal((await app.fetch(post('sampleId', { origin:'https://attacker.invalid' }), env)).status, 403);
  assert.equal((await app.fetch(post('https://attacker.invalid/gifs/sampleId'), env)).status, 400);
  assert.equal((await app.fetch(post('notFound'), env)).status, 422);
  assert.equal((await app.fetch(post('https://giphy.com/gifs/test-sampleId'), env)).status, 303);
  assert.equal((await app.fetch(post('sampleId'), env)).status, 409);
  assert.equal((await app.fetch(post('sampleId', {action:'remove'}), env)).status, 400);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.at(-1), 'sampleId');
  assert.equal((await app.fetch(post('sampleId', {path:'/manage', action:'remove'}), env)).status, 303);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.includes('sampleId'), false);
  assert.equal((await app.fetch(post('a'.repeat(2500)), env)).status, 413);
  for (let i = 0; i < 91; i++) assert.equal((await app.fetch(post(`test${i}`), env)).status, 303);
  assert.equal((await app.fetch(post('overLimit'), env)).status, 409);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.length, 100);
});

test('rate limit blocks submissions before looking up the GIF', async () => {
  const app = createWorker({checkGif:async () => { throw new Error('must not query GIPHY'); }});
  const env = { CATALOG_DB:db(), ADD_RATE_LIMIT:{ limit:async ({key}) => {
    assert.equal(key, '192.0.2.5');
    return {success:false};
  } } };
  assert.equal((await app.fetch(post('blocked'), env)).status, 429);
  assert.equal((await (await app.fetch(get(), env)).json()).ids.length, 9);
});

test('GIPHY lookup uses a fixed endpoint and distinguishes not found from an upstream failure', async () => {
  assert.equal(await verifyGif('sampleId', async (url, init) => {
    assert.equal(url.origin + url.pathname, 'https://giphy.com/services/oembed');
    assert.equal(url.searchParams.get('url'), 'https://giphy.com/gifs/sampleId');
    assert.equal(init.redirect, 'manual');
    return Response.json({provider_name:'GIPHY'});
  }), true);
  for (const status of [302, 403, 404]) assert.equal(await verifyGif('sampleId', async () => new Response(null, {status})), false);
  await assert.rejects(verifyGif('sampleId', async () => new Response(null, {status:503})), /availability check failed/);
});

test('verified Worker Access context must match the application and owner', async () => {
  const env = { ACCESS_AUD:'my-app', ADMIN_EMAIL:'owner@example.test' };
  const context = (aud,email) => ({access:{aud,getIdentity:async () => ({email})}});
  assert.equal(await isAdmin(get('/manage'), env, undefined, context('my-app','owner@example.test')), true);
  assert.equal(await isAdmin(get('/manage'), env, undefined, context('another-app','owner@example.test')), false);
  assert.equal(await isAdmin(get('/manage'), env, undefined, context('my-app','another@example.test')), false);
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
  const req = token => new Request(site+'/manage', { headers:{ 'Cf-Access-Jwt-Assertion':token } });
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
