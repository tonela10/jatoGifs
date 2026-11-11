/* Isolated integration tests. Requires an existing Playwright installation;
   no user browser profile or account is read. All GitHub/GIPHY traffic is mocked. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'extension');
const artifactDir = process.env.JATO_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'jatogifs-evidence-'));
fs.mkdirSync(artifactDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jatogifs-profile-'));
const executablePath = process.env.JATO_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const fixture = `<!doctype html><html lang="es" data-color-mode="light"><head><meta charset="utf-8"><title>Prueba aislada · jatoGifs</title><style>body{margin:50px auto;max-width:880px;padding:0 30px;background:#fff;color:#1f2328;font:15px/1.5 system-ui}textarea{box-sizing:border-box;width:100%;height:160px;padding:16px;font:15px/1.5 system-ui;border:1px solid #d1d9e0;border-radius:6px}h1{font-size:24px}label{display:block;margin:16px 0 8px}button{padding:10px;margin:8px 0}#mirror{white-space:pre-wrap}</style></head><body><h1>jatoGifs · prueba aislada</h1><p>Editor de prueba y GIF sintéticos. No se publica ningún comentario.</p><label for="comment_body">Comentario</label><textarea id="comment_body" name="comment[body]" placeholder="Escribe /gif"></textarea><div id="mirror"></div><label for="issue_body">Otro borrador</label><textarea id="issue_body" name="issue[body]">Otro borrador que debe conservarse.</textarea><label for="source_code">Editor de código excluido</label><div class="cm-editor"><textarea id="source_code" name="code"></textarea></div><button id="add">Abrir otro editor</button><script>document.addEventListener('input',e=>{if(e.target.id==='comment_body')document.getElementById('mirror').textContent=e.target.value});document.getElementById('add').onclick=()=>{const t=document.createElement('textarea');t.id='dynamic_comment_body';t.name='comment[body]';document.body.append(t)};</script></body></html>`;
const gif = i => ({ id: String(i), title: `Prueba ${i} GIF`, username: 'tonela10', images: { original: { url: `https://media.giphy.com/jato-test-${i}/giphy.gif?cid=unchanged&rid=giphy.gif` }, fixed_width: { url: `https://media.giphy.com/jato-test-${i}/200w.gif?rid=200w.gif` } } });
let state = 'success';
let calls = [];
let errors = [];

(async () => {
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, viewport: { width: 1280, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--disable-brave-update', '--no-first-run'] });
  try {
    await context.route('https://github.com/**', route => route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': "frame-src 'self' https://viewscreen.githubusercontent.com; img-src 'self' data: https://*.githubusercontent.com" }, body: fixture }));
    await context.route('https://api.giphy.com/**', async route => {
      const url = new URL(route.request().url()); const ids = url.searchParams.get('ids')?.split(',') || []; calls.push({ ids, q: url.searchParams.get('q'), path:url.pathname });
      if (state === 'offline') return route.abort('internetdisconnected');
      if (state === 'invalid-key' || state === 'rate') return route.fulfill({ status: state === 'rate' ? 429 : 401, contentType: 'application/json', body: '{}' });
      const data = state === 'empty' ? [] : ids.map(id => gif(id));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data, meta: { status: 200, response_id: 'synthetic-integration' } }) });
    });
    await context.route('https://media.giphy.com/jato-test-*/**', route => {
      const id = route.request().url().match(/jato-test-(\d+)/)[1];
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180"><rect width="200" height="180" fill="${['#18364d','#125d50','#533c6d','#734a30'][Number(id)%4]}"/><text x="100" y="96" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24">Prueba ${id}</text></svg>` });
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.locator('#api-key').fill('synthetic-integration-key');
    await options.getByRole('button', { name: 'Guardar clave' }).click();
    await options.getByText('Clave guardada.', { exact: false }).waitFor();
    await options.locator('#gif-entries').fill(Array.from({length:27},(_,i)=>String(i+1)).join('\n'));
    await options.getByRole('button',{name:'Guardar colección',exact:true}).click();
    await options.locator('#collection-result').filter({hasText:'Colección guardada: 27 GIF'}).waitFor();
    // An invalid list must not replace the existing collection.
    await options.locator('#gif-entries').fill('https://evil.test/gifs/one');
    await options.getByRole('button',{name:'Guardar colección',exact:true}).click();
    await options.locator('#collection-result').filter({hasText:'Línea 1'}).waitFor();
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://github.com/jatogifs/test/issues/new');
    const editor = page.locator('#comment_body');
    const picker = page.frameLocator('#jatogifs-picker');
    const open = async (value = '/gif') => { await editor.fill(value); await picker.locator('#status').waitFor({ state: 'attached' }); };

    await open();
    await picker.locator('.gif').first().waitFor({ timeout: 15000 });
    assert.equal(await picker.locator('.gif').count(), 25, 'extension iframe is usable under a restrictive GitHub-like CSP');
    await editor.press('Enter');
    await page.locator('#jatogifs-picker').waitFor({ state: 'detached' });
    const inserted = await editor.inputValue();
    assert.match(inserted, /^!\[Prueba 1 GIF\]\(<https:\/\/media.giphy.com\/jato-test-1\/giphy.gif\?cid=unchanged&rid=giphy.gif>\)$/);
    assert.equal(await page.locator('#mirror').textContent(), inserted, 'native input updates a controlled editor');
    await editor.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    assert.equal(await editor.inputValue(), '/gif', 'native undo restores the command');
    // Undo can reopen the picker because it generates a real input event.
    await editor.press('Escape');
    await page.locator('#jatogifs-picker').waitFor({ state: 'detached' });

    await editor.fill('Antes /gif después');
    await editor.evaluate(el => { el.setSelectionRange(10,10); el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:'f' })); });
    await picker.locator('.gif').first().waitFor();
    await editor.press('ArrowRight');
    await picker.locator('.gif').nth(1).evaluate(el => { if (document.activeElement !== el) throw new Error('Arrow navigation must move accessible focus'); });
    await picker.locator('.gif').nth(1).press('Enter');
    await page.locator('#jatogifs-picker').waitFor({ state:'detached' });
    assert.match(await editor.inputValue(), /^Antes !\[Prueba 2 GIF\].* después$/);
    assert.equal(await page.locator('#issue_body').inputValue(), 'Otro borrador que debe conservarse.');

    await open(); await picker.locator('.gif').first().waitFor();
    await editor.press('Tab');
    await picker.locator('.gif').first().evaluate(el => { if (document.activeElement !== el) throw new Error('Tab must enter the gallery'); });
    await picker.locator('.gif').first().press('Tab');
    await picker.locator('#more').evaluate(el => { if (document.activeElement !== el) throw new Error('Tab must reach pagination'); });
    await picker.getByRole('button', { name:'Cargar más', exact:true }).click();
    await picker.locator('.gif').nth(26).waitFor();
    assert.equal(await picker.locator('.gif').count(), 27);
    assert.deepEqual(calls.at(-1).ids, ['26','27']);
    await page.screenshot({ path:path.join(artifactDir, 'selector-light.png'), fullPage:true });
    await picker.locator('#more').press('Escape');
    await page.locator('#jatogifs-picker').waitFor({state:'detached'});

    await page.evaluate(() => document.documentElement.dataset.colorMode = 'dark');
    await open(); await picker.locator('.gif').first().waitFor();
    await picker.locator('html[data-theme="dark"]').waitFor();
    await page.screenshot({ path:path.join(artifactDir, 'selector-dark.png'), fullPage:true });
    await editor.fill('/gif cambiado');
    await page.locator('#jatogifs-picker').waitFor({state:'detached'});
    assert.equal(await editor.inputValue(), '/gif cambiado', 'changed drafts cancel the selection');

    for (const [mode, text] of [['empty','ya no están disponibles'],['invalid-key','clave de GIPHY no es válida'],['rate','límite de GIPHY'],['offline','No se pudo conectar']]) {
      state = mode; await open(); await picker.locator('#status').filter({ hasText:text }).waitFor();
      await editor.press('Escape'); await page.locator('#jatogifs-picker').waitFor({state:'detached'});
    }
    state = 'success';
    await page.locator('#source_code').fill('/gif');
    assert.equal(await page.locator('#jatogifs-picker').count(),0);
    await page.getByRole('button', {name:'Abrir otro editor'}).click();
    await page.locator('#dynamic_comment_body').fill('/gif');
    await picker.locator('.gif').first().waitFor();
    await picker.locator('.gif').first().click();
    assert.match(await page.locator('#dynamic_comment_body').inputValue(),/^!\[/);

    await page.setViewportSize({ width:640, height:560 });
    await page.evaluate(() => document.documentElement.style.zoom='1.25');
    await editor.scrollIntoViewIfNeeded(); await open(); await picker.locator('.gif').first().waitFor();
    const bounds = await page.locator('#jatogifs-picker').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x+bounds.width<=641 && bounds.y+bounds.height<=561, 'selector fits zoomed viewport');
    await page.screenshot({path:path.join(artifactDir,'selector-compact.png'),fullPage:true});
    await editor.press('Escape');
    await page.goto('https://github.com/jatogifs/test/pull/1');
    await open(); await picker.locator('.gif').first().waitFor();
    await picker.locator('.gif').first().click();
    assert.match(await editor.inputValue(),/^!\[/);
    assert.ok(calls.every(c => c.q === null && c.path === '/v1/gifs' && c.ids.length <= 100));
    assert.deepEqual(errors, []);
    const report = { browser: executablePath, version:context.browser()?.version(), status:'passed', scenarios:['extension iframe + restrictive page CSP','keyboard insertion','native undo','middle insertion','other drafts preserved','keyboard focus and pagination','light/dark','draft cancellation','empty/401/429/offline','excluded code editor','dynamic editor','zoom','page navigation'], api:'mocked', github:'mocked', screenshots:artifactDir };
    fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await context.close(); fs.rmSync(profile,{recursive:true,force:true}); }
})().catch(error => { console.error(error); process.exitCode=1; });
