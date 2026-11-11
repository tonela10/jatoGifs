const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const extension = path.join(__dirname, '../extension');
const session = '12345678-1234-1234-1234-123456789012';
const id = 'testextension';
const content = { url:'https://github.com/owner/repo/issues/1', tab:{id:7}, frameId:0 };
const picker = { url:`chrome-extension://${id}/picker.html`, tab:{id:7}, frameId:12 };
const gif = { title:'Example GIF', url:'https://media.giphy.com/example/giphy.gif?rid=keep' };

function startWorker(state = {}) {
  let listener; const sent = [];
  const storage = {
    setAccessLevel:async () => {},
    get:async key => key === null ? {...state} : { [key]:state[key] },
    set:async entries => Object.assign(state,entries),
    remove:async key => {delete state[key];}
  };
  const scope = { console, URL, AbortSignal, fetch:async () => { throw new Error('No real network in tests'); }, self:{},
    chrome:{ storage:{local:storage,session:storage}, runtime:{getURL:file=>`chrome-extension://${id}/${file}`,onMessage:{addListener:fn=>{listener=fn;}},openOptionsPage:async()=>{}}, tabs:{ sendMessage:async (tabId,message)=>{sent.push({tabId,message});},onRemoved:{addListener:()=>{}}} }
  };
  const context = vm.createContext(scope);
  scope.importScripts = (...names) => { for (const name of names) {
    if (name === 'config.js') scope.self.JATO_CONFIG = {apiKey:'test-app-key',channel:'tonela10'};
    else vm.runInContext(fs.readFileSync(path.join(extension,name),'utf8'),context);
  }};
  vm.runInContext(fs.readFileSync(path.join(extension,'background.js'),'utf8'),context);
  return { state, sent, send: (message,sender) => new Promise(resolve=>{if(!listener(message,sender,resolve))resolve(undefined);}) };
}

test('only GitHub top-frame content may open a picker session', async () => {
  const worker = startWorker();
  for (const sender of [{...content,url:'https://evil.test/'},{...content,frameId:2},picker]) {
    const reply = await worker.send({type:'OPEN',session},sender); assert.equal(reply.ok,false);
  }
  assert.equal((await worker.send({type:'OPEN',session},content)).ok,true);
});
test('selection works after service worker restart without storing media URLs', async () => {
  const first = startWorker();
  await first.send({type:'OPEN',session},content);
  assert.equal(JSON.stringify(first.state).includes('giphy.com'),false);
  const resumed = startWorker(first.state);
  assert.equal((await resumed.send({type:'SELECT',session,gif},picker)).ok,true);
  assert.equal(resumed.sent[0].tabId,7);
  assert.equal(resumed.sent[0].message.gif.url,gif.url);
  assert.deepEqual(resumed.state,{});
});
test('the page, another tab or an invalid URL cannot inject a selected GIF', async () => {
  const worker=startWorker(); await worker.send({type:'OPEN',session},content);
  for (const sender of [content,{...picker,tab:{id:8}}]) assert.equal((await worker.send({type:'SELECT',session,gif},sender)).ok,false);
  assert.equal((await worker.send({type:'SELECT',session,gif:{...gif,url:'https://evil.test/gif'}},picker)).ok,false);
  assert.equal(worker.sent.length,0);
});
test('closed sessions cannot select later; only their owning tab can close them', async () => {
  const worker=startWorker(); await worker.send({type:'OPEN',session},content);
  await worker.send({type:'CLOSE',session},{...content,tab:{id:8}});
  assert.ok(Object.keys(worker.state).length);
  await worker.send({type:'CLOSE',session},content);
  assert.equal((await worker.send({type:'SELECT',session,gif},picker)).ok,false);
});
