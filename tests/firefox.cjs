// Firefox desktop smoke test with a temporary add-on and an isolated profile.
// No account or production drafts are used. The editor is injected locally into
// the public repository page, so GitHub's real frame policy still applies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { load, media } = require('../extension/catalog.js');

const driverBinary = process.env.JATO_GECKODRIVER;
const firefoxBinary = process.env.JATO_FIREFOX;
const archive = process.env.JATO_ZIP;
assert.ok(driverBinary && firefoxBinary && archive, 'Set JATO_GECKODRIVER, JATO_FIREFOX and JATO_ZIP');
assert.ok(fs.statSync(archive).isFile());
const addonId = 'jatogifs@tonela10';
const el = 'element-6066-11e4-a52e-4f735466cecf';
const driver = spawn(driverBinary, ['--port', '0'], { stdio:['ignore','pipe','pipe'] });
let output = '';
driver.stdout.on('data', chunk => { output += chunk; });
driver.stderr.on('data', chunk => { output += chunk; });

async function until(test, label, ms = 20000) {
  const deadline = Date.now() + ms;
  do {
    const value = await test();
    if (value) return value;
    await delay(200);
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}`);
}

(async () => {
  const ids = await load();
  assert.ok(ids.length > 1);
  const port = await until(() => {
    if (driver.exitCode !== null) throw new Error('GeckoDriver exited before it started');
    return output.match(/Listening on 127\.0\.0\.1:(\d+)/)?.[1];
  }, 'GeckoDriver start', 10000);
  let session = '';
  async function command(method, route, body) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method, headers:{'Content-Type':'application/json'},
      body:body === undefined ? undefined : JSON.stringify(body),
      signal:AbortSignal.timeout(35000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`${route}: ${result.value?.error}: ${result.value?.message}`);
    return result.value;
  }
  const execute = (script, ...args) => command('POST', `/session/${session}/execute/sync`, {script,args});
  const navigate = url => command('POST', `/session/${session}/url`, {url});
  const frame = id => command('POST', `/session/${session}/frame`, {id});
  const find = async selector => {
    const result = await command('POST', `/session/${session}/element`, {using:'css selector',value:selector});
    return result[el];
  };
  const click = async selector => command('POST', `/session/${session}/element/${await find(selector)}/click`, {});
  const type = async (selector, text) => command('POST', `/session/${session}/element/${await find(selector)}/value`, {text});
  try {
    const start = await command('POST','/session',{capabilities:{alwaysMatch:{
      browserName:'firefox', timeouts:{implicit:0,pageLoad:25000,script:10000},
      'moz:firefoxOptions':{binary:path.resolve(firefoxBinary),args:['-headless']},
    }}});
    session = start.sessionId;
    assert.equal(await command('POST',`/session/${session}/moz/addon/install`,{path:path.resolve(archive),temporary:true}),addonId);

    await navigate('https://github.com/tonela10/jatoGifs');
    assert.equal(await execute('return location.origin'),'https://github.com');
    await execute(`
      const draft = document.createElement('textarea');
      draft.id = 'jatogifs-test-draft';
      draft.name = 'comment[body]';
      draft.style.cssText = 'position:fixed;top:100px;left:40px;width:400px;height:100px;z-index:2147483640';
      document.body.append(draft);
    `);
    const editor = '#jatogifs-test-draft';
    await type(editor,'/gif');
    await until(()=>execute("return Boolean(document.querySelector('#jatogifs-picker'))"),'picker injected on github.com');
    await frame({[el]:await find('#jatogifs-picker')});
    const expected = Math.min(ids.length,25);
    await until(()=>execute("return document.querySelectorAll('.gif').length === arguments[0]",expected),'GIF tiles render inside the extension iframe');
    await execute("document.querySelectorAll('.gif img').forEach(img=>{img.loading='eager'})");
    await until(()=>execute("return [...document.querySelectorAll('.gif img')].every(img=>img.complete&&img.naturalWidth>0)"),'all previews loaded');
    await click('.gif:nth-child(2)');
    await frame(null);
    await until(()=>execute("return document.querySelector('#jatogifs-test-draft').value === arguments[0]",`![GIF de GIPHY](<${media(ids[1]).url}>)`),'mouse insertion');
    await execute("const d=document.querySelector('#jatogifs-test-draft'); d.value=''; d.focus();");
    await type(editor,'/gif');
    await until(()=>execute("return Boolean(document.querySelector('#jatogifs-picker'))"),'keyboard picker');
    await frame({[el]:await find('#jatogifs-picker')});
    await until(()=>execute("return Boolean(document.querySelector('.gif[data-selected=true]'))"),'keyboard selection is ready');
    await frame(null);
    await type(editor,'\uE014\uE007'); // ArrowRight, Enter
    await until(()=>execute("return document.querySelector('#jatogifs-test-draft').value === arguments[0]",`![GIF de GIPHY](<${media(ids[1]).url}>)`),'keyboard insertion');
    await execute("const d=document.querySelector('#jatogifs-test-draft'); d.value=''; d.focus();");
    await type(editor,'/gif');
    await until(()=>execute("return Boolean(document.querySelector('#jatogifs-picker'))"),'options picker');
    const handles = await command('GET',`/session/${session}/window/handles`);
    await frame({[el]:await find('#jatogifs-picker')});
    await until(()=>execute(`
      const button = document.querySelector('#settings');
      const rect = button?.getBoundingClientRect();
      return rect && rect.bottom <= innerHeight && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button;
    `),'settings button is visible');
    await click('#settings');
    const options = await until(async()=> (await command('GET',`/session/${session}/window/handles`)).find(h=>!handles.includes(h)), 'options tab opens');
    await command('POST',`/session/${session}/window`,{handle:options});
    await until(async()=> /^moz-extension:\/\/[^/]+\/options\.html$/.test(await command('GET',`/session/${session}/url`)), 'options page opens');
    console.log(JSON.stringify({ firefox:start.capabilities.browserVersion, catalogue:ids.length, options:'passed', mouse:'passed', keyboard:'passed', github:'public GitHub page, local test draft' }));
  } finally {
    if (session) await command('DELETE',`/session/${session}`).catch(()=>{});
  }
})().catch(error => {
  console.error(error.message);
  if (process.env.JATO_DRIVER_LOG) console.error(output.slice(-7000));
  process.exitCode = 1;
}).finally(()=>driver.kill());
