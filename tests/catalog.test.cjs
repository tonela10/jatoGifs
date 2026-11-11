const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DEFAULT_IDS,parse,validate}=require('../extension/catalog.js');
test('includes the selected GIF in the default collection',()=>{
  const id = parse('https://giphy.com/gifs/test-production-testing-o5usW6VUC2TkUrC42m')[0];
  assert.equal(DEFAULT_IDS.length,9);
  assert.ok(DEFAULT_IDS.includes(id));
  assert.deepEqual(validate(DEFAULT_IDS),DEFAULT_IDS);
});
test('accepts IDs, GIPHY page URLs and embed URLs, storing IDs only',()=>{
  assert.deepEqual(parse('one\nhttps://giphy.com/gifs/title-two?utm_source=test\nhttps://www.giphy.com/embed/three\n\none'),['one','two','three']);
  assert.deepEqual(parse(''),[]);
});
test('rejects foreign hosts, unsafe schemes and invalid paths with a useful line number',()=>{
  for(const url of ['https://evil.test/gifs/one','http://giphy.com/gifs/one','https://giphy.com/channel/tonela10','https://giphy.com.evil.test/gifs/one','https://user@giphy.com/gifs/one','https://media.giphy.com/media/one/giphy.gif']) assert.throws(()=>parse(`valid\n${url}`),/Línea 2/);
});
test('enforces 100 distinct IDs, avoiding oversized API requests',()=>{
  assert.equal(parse(Array.from({length:100},(_,i)=>`id${i}`).join('\n')).length,100);
  assert.throws(()=>parse(Array.from({length:101},(_,i)=>`id${i}`).join('\n')),/100/);
});
