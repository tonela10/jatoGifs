// Real Cloudflare catalogue and GIPHY images. The GitHub editor is a local fixture.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { load, media } = require('../extension/catalog.js');
const extension = path.resolve(__dirname, '../extension');
const artifacts = process.env.JATO_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'jatogifs-live-evidence-'));
fs.mkdirSync(artifacts, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jatogifs-live-profile-'));
const executablePath = process.env.JATO_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const demo = 'https://github.com/jatogifs/demo/pull/1';
const fixture = `<!doctype html><html lang="es" data-color-mode="dark"><head><meta charset="utf-8"><title>jatoGifs · demostración</title><style>
:root{color-scheme:dark;background:#0d1117;color:#f0f6fc;font:16px/1.5 system-ui,sans-serif}
body{margin:0} main{max-width:740px;margin:30px auto 0;padding:0 24px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
strong{font-size:18px}small{color:#b1bac4;border:1px solid #3d444d;border-radius:100px;padding:3px 10px}
label{display:block;margin:0 0 8px;color:#b1bac4;font-weight:600;font-size:14px}
textarea{display:block;width:100%;height:96px;box-sizing:border-box;background:#161b22;color:#f0f6fc;border:1px solid #3d444d;border-radius:8px;font:15px/1.5 ui-monospace,monospace;padding:14px;resize:none}
textarea:focus-visible{outline:2px solid #58a6ff;outline-offset:2px}
button{margin:12px 0;padding:6px 10px}#rendered img{max-width:100%;max-height:380px}
</style></head><body><main><header><strong>tonela10 / jatoGifs</strong><small>Editor de demostración</small></header><label for="comment_body">Comentario de revisión</label><textarea id="comment_body" name="comment[body]"></textarea><button type="button" id="preview">Vista previa</button><div id="rendered"></div></main>
<script>document.querySelector('#preview').onclick=()=>{const draft=document.querySelector('textarea').value;const match=draft.match(/<([^>]+)>/);if(!match)return;const image=document.createElement('img');image.src=match[1];image.alt='GIF de GIPHY';document.querySelector('#rendered').replaceChildren(image);};</script></body></html>`;

(async () => {
  const ids = await load();
  assert.ok(ids.length > 0);
  const context = await chromium.launchPersistentContext(profile, {
    executablePath, headless:true, viewport:{width:920,height:690}, colorScheme:'dark',
    ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--disable-brave-update'],
  });
  try {
    let apiRequests = 0;
    await context.route('https://api.giphy.com/**', route => { apiRequests++; return route.abort(); });
    await context.route(demo, route => route.fulfill({contentType:'text/html',body:fixture}));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
    const id = new URL(worker.url()).host;
    assert.deepEqual(await worker.evaluate(() => chrome.storage.local.get(null)), {}, 'the profile starts without settings');
    const options = await context.newPage();
    await options.goto(`chrome-extension://${id}/options.html`);
    assert.equal(await options.locator('input[type=password]').count(),0);
    await options.getByRole('button',{name:'Comprobar catálogo',exact:true}).click();
    const noun = ids.length === 1 ? 'entrada' : 'entradas';
    await options.getByText(`Conexión correcta: ${ids.length} ${noun} en el catálogo.`).waitFor({timeout:18000});
    await options.screenshot({path:path.join(artifacts,'configuracion.png'),fullPage:true});

    const page = await context.newPage();
    await page.goto(demo);
    const editor = page.locator('#comment_body');
    await editor.fill('¡Listo para aprobar! /gif');
    const picker = page.frameLocator('#jatogifs-picker');
    const firstPage = ids.slice(0,25);
    await picker.locator('.gif').nth(firstPage.length-1).waitFor({timeout:20000});
    const frame = page.frames().find(f => f.url().startsWith(`chrome-extension://${id}/picker.html`));
    await frame.locator('.gif img').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
    await frame.waitForFunction(() => [...document.querySelectorAll('.gif img')].every(img => img.complete && img.naturalWidth > 0),{timeout:25000});
    assert.deepEqual(await picker.locator('.gif img').evaluateAll(images=>images.map(img=>img.src)), firstPage.map(id=>media(id).preview));
    await page.screenshot({path:path.join(artifacts,'selector.png')});
    await picker.locator('.gif').first().click();
    assert.equal(await editor.inputValue(), `¡Listo para aprobar! ![GIF de GIPHY](<${media(ids[0]).url}>)`);
    await page.getByRole('button',{name:'Vista previa'}).click();
    await page.locator('#rendered img').evaluate(img => img.decode());
    assert.equal(await page.locator('#rendered img').getAttribute('src'), media(ids[0]).url);
    assert.equal(apiRequests,0);
    assert.deepEqual(await worker.evaluate(() => chrome.storage.local.get(null)),{});
    const report={status:'passed',browser:context.browser()?.version(),catalogue:ids.length,loaded:firstPage.length,github:'editor de demostración, sin publicar comentarios',credentials:false,apiRequests};
    fs.writeFileSync(path.join(artifacts,'live-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await context.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(profile,{recursive:true,force:true}));
