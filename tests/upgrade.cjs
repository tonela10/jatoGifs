// Upgrade an unpacked release at the same path in an isolated browser profile.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const previous = process.env.JATO_PREVIOUS_DIR;
assert.ok(previous,'Set JATO_PREVIOUS_DIR to an extracted jatoGifs 1.2.1 release');
assert.equal(JSON.parse(fs.readFileSync(path.join(previous,'manifest.json'))).version,'1.2.1');
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'jatogifs-upgrade-')));
const profile = path.join(tmp,'profile');
const extension = path.join(tmp,'extension');
const executablePath = process.env.JATO_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

async function launch() {
  const context = await chromium.launchPersistentContext(profile,{
    executablePath,headless:true,ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--disable-brave-update'],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:18000});
    return { context, worker, id:new URL(worker.url()).host };
  } catch (error) { await context.close(); throw error; }
}

(async () => {
  fs.cpSync(previous,extension,{recursive:true});
  const old = await launch();
  try {
    await old.worker.evaluate(() => chrome.storage.local.set({apiKey:'synthetic-legacy-key',gifIds:['example']}));
    assert.equal(await old.worker.evaluate(async()=>Boolean((await chrome.storage.local.get('apiKey')).apiKey)),true);
    const manager = await old.context.newPage();
    await manager.goto('chrome://extensions/');
    const card = manager.locator('extensions-item').filter({hasText:'jatoGifs'});
    await card.waitFor({timeout:10000});
    const dev = manager.locator('#devMode');
    if (await dev.getAttribute('aria-pressed') !== 'true' && await dev.getAttribute('aria-checked') !== 'true') await dev.click();
    const reload = card.locator('#dev-reload-button');
    await reload.waitFor({timeout:10000});

    fs.rmSync(extension,{recursive:true,force:true});
    fs.cpSync(path.resolve(__dirname,'../extension'),extension,{recursive:true});
    await reload.click();
    await card.getByText('1.3.0',{exact:false}).waitFor({timeout:12000});
    await old.context.route('https://jato.sediles.dev/api/catalog', route => route.fulfill({json:{version:1,ids:['example']}}));
    const page = await old.context.newPage();
    for (let i=0;;i++) {
      try { await page.goto(`chrome-extension://${old.id}/options.html`); break; }
      catch (error) {
        if (i === 24 || !error.message.includes('ERR_BLOCKED_BY_CLIENT')) throw error;
        await delay(200);
      }
    }
    await page.getByRole('button',{name:'Comprobar catálogo'}).click();
    await page.getByText('Conexión correcta: 1 entrada en el catálogo.').waitFor();
    const current = old.context.serviceWorkers().find(worker => worker !== old.worker && worker.url() === old.worker.url());
    assert.ok(current, 'the catalogue check started the replacement worker');
    assert.equal(new URL(current.url()).host,old.id,'extension identity stays the same on upgrade');
    assert.equal(await current.evaluate(()=>chrome.runtime.getManifest().version),'1.3.0');
    assert.equal(await current.evaluate(()=>typeof JatoCatalog.media),'function','background must reload from the new unpacked files');
    let storage;
    for (let i=0;i<20;i++) {
      storage = await current.evaluate(()=>chrome.storage.local.get(null));
      if (!Object.hasOwn(storage,'apiKey')) break;
      await delay(100);
    }
    assert.deepEqual(storage,{gifIds:['example']},'old key was removed, previous list preserved');
    await page.getByText('Ver mi antigua colección local').waitFor();
    await page.getByText('Ver mi antigua colección local').click();
    assert.equal(await page.locator('#legacy-entries').inputValue(),'https://giphy.com/gifs/example');
    console.log('Actualización 1.2.1 → 1.3.0 verificada: misma extensión, sin clave y con lista anterior.');
  } finally { await old.context.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(tmp,{recursive:true,force:true}));
