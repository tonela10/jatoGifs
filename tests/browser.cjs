/* Isolated integration tests. Requires an existing Playwright installation;
   no user browser profile or account is read. GitHub and media are mocked; the real catalogue Worker uses SQLite in memory. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'extension');
const artifactDir = process.env.JATO_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'jatogifs-evidence-'));
fs.mkdirSync(artifactDir, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jatogifs-profile-'));
const executablePath = process.env.JATO_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const fixture = `<!doctype html><html lang="es" data-color-mode="light"><head><meta charset="utf-8"><title>Prueba aislada · jatoGifs</title><style>body{margin:50px auto;max-width:880px;padding:0 30px;background:#fff;color:#1f2328;font:15px/1.5 system-ui}textarea{box-sizing:border-box;width:100%;height:160px;padding:16px;font:15px/1.5 system-ui;border:1px solid #d1d9e0;border-radius:6px}h1{font-size:24px}label{display:block;margin:16px 0 8px}button{padding:10px;margin:8px 0}#mirror{white-space:pre-wrap}</style></head><body><h1>jatoGifs · prueba aislada</h1><p>Editor de prueba y GIF sintéticos. No se publica ningún comentario.</p><label for="comment_body">Comentario</label><textarea id="comment_body" name="comment[body]" placeholder="Escribe /gif"></textarea><div id="mirror"></div><label for="issue_body">Otro borrador</label><textarea id="issue_body" name="issue[body]">Otro borrador que debe conservarse.</textarea><label for="source_code">Editor de código excluido</label><div class="cm-editor"><textarea id="source_code" name="code"></textarea></div><button id="add">Abrir otro editor</button><script>document.addEventListener('input',e=>{if(e.target.id==='comment_body')document.getElementById('mirror').textContent=e.target.value});document.getElementById('add').onclick=()=>{const t=document.createElement('textarea');t.id='dynamic_comment_body';t.name='comment[body]';document.body.append(t)};</script></body></html>`;
const site = 'https://jato.sediles.dev';
const originalIds = Array.from({length:27}, (_,i) => String(i+1));
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(path.join(root, 'cloudflare/migrations/0001_catalog.sql'), 'utf8'));
db.exec('DELETE FROM gifs');
for (const id of originalIds) db.prepare('INSERT INTO gifs (id) VALUES (?)').run(id);
const env = {
  CATALOG_DB: { prepare: sql => ({ bind: (...args) => ({
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: db.prepare(sql).run(...args) }),
  }) }) },
  ADD_RATE_LIMIT: { limit: async () => ({ success:true }) },
};
let state = 'success';
let catalogRequests = 0;
let imageRequests = [];
let apiRequests = [];
let errors = [];

(async () => {
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, viewport: { width: 1280, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--disable-brave-update', '--no-first-run'] });
  try {
    await context.route('https://github.com/**', route => route.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': "frame-src 'self' https://viewscreen.githubusercontent.com; img-src 'self' data: https://*.githubusercontent.com" }, body: fixture }));
    const { createWorker } = await import('../cloudflare/worker.mjs');
    const website = createWorker({ checkGif: async id => id === '42' });
    await context.route(site + '/**', async route => {
      const request = route.request();
      if (request.url() === site + '/api/catalog') {
        catalogRequests++;
        if (state === 'offline') return route.abort('internetdisconnected');
        if (state === 'empty') return route.fulfill({ json: { version:1, ids:[] } });
      }
      const response = await website.fetch(new Request(request.url(), {
        method: request.method(),
        headers: { ...await request.allHeaders(), 'CF-Connecting-IP': '203.0.113.15' },
        body: request.postDataBuffer() ?? undefined,
      }), env);
      return route.fulfill({ status:response.status, headers:Object.fromEntries(response.headers), body:Buffer.from(await response.arrayBuffer()) });
    });
    await context.route('https://api.giphy.com/**', route => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await context.route('https://media.giphy.com/media/**', route => {
      const [,id,filename] = new URL(route.request().url()).pathname.match(/^\/media\/(\d+)\/(200w\.gif|giphy\.gif)$/);
      imageRequests.push({id,filename});
      if (state === 'bad-images' && (id === '2' || (id === '1' && filename === '200w.gif'))) {
        return route.fulfill({ status:404 });
      }
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180"><rect width="200" height="180" fill="${['#18364d','#125d50','#533c6d','#734a30'][Number(id)%4]}"/><text x="100" y="96" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24">Prueba ${id}</text></svg>` });
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    assert.equal(await options.locator('input[type=password]').count(), 0);
    await options.getByRole('button', { name: 'Comprobar catálogo' }).click();
    await options.getByText('Conexión correcta: 27 entradas en el catálogo.').waitFor();
    assert.equal(imageRequests.length,0,'checking options only fetches IDs');
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
    assert.equal(inserted, '![GIF de GIPHY](<https://media.giphy.com/media/1/giphy.gif>)');
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
    assert.equal(await editor.inputValue(), 'Antes ![GIF de GIPHY](<https://media.giphy.com/media/2/giphy.gif>) después');
    assert.equal(await page.locator('#issue_body').inputValue(), 'Otro borrador que debe conservarse.');

    await open(); await picker.locator('.gif').first().waitFor();
    await editor.press('Tab');
    await picker.locator('.gif').first().evaluate(el => { if (document.activeElement !== el) throw new Error('Tab must enter the gallery'); });
    await picker.locator('.gif').first().press('Tab');
    await picker.locator('#more').evaluate(el => { if (document.activeElement !== el) throw new Error('Tab must reach pagination'); });
    const beforePagination = catalogRequests;
    await picker.getByRole('button', { name:'Cargar más', exact:true }).click();
    await picker.locator('.gif').nth(26).waitFor();
    assert.equal(await picker.locator('.gif').count(), 27);
    assert.match(await picker.locator('.gif img').nth(26).getAttribute('src'), /\/27\/200w\.gif$/);
    assert.equal(catalogRequests, beforePagination, 'pagination retains the open catalogue');
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

    for (const [mode, text] of [['empty','El catálogo está vacío'],['offline','No se pudo cargar el catálogo']]) {
      state = mode; await open(); await picker.locator('#status').filter({ hasText:text }).waitFor();
      if (mode === 'offline') {
        state = 'success';
        await picker.getByRole('button',{name:'Reintentar'}).click();
        await picker.locator('.gif').first().waitFor();
      }
      await editor.press('Escape'); await page.locator('#jatogifs-picker').waitFor({state:'detached'});
    }
    state = 'bad-images';
    imageRequests = [];
    await open();
    const unavailable = picker.getByRole('button',{name:'GIF 2 no disponible'});
    await unavailable.waitFor();
    assert.equal(await unavailable.isDisabled(),true);
    const firstPreview = picker.locator('.gif img').first();
    await firstPreview.evaluate(img => img.decode());
    assert.match(await firstPreview.getAttribute('src'), /\/1\/giphy\.gif$/);
    assert.deepEqual(imageRequests.filter(r=>r.id==='2').map(r=>r.filename),['200w.gif','giphy.gif']);
    await editor.press('ArrowRight');
    await picker.getByRole('button',{name:'Insertar GIF 3'}).evaluate(el => { if (document.activeElement !== el) throw new Error('Keyboard must skip unavailable GIF'); });
    await picker.getByRole('button',{name:'Insertar GIF 3'}).press('Escape');
    await page.locator('#jatogifs-picker').waitFor({state:'detached'});
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
    const formPage = await context.newPage();
    await formPage.goto(site);
    await formPage.getByRole('textbox',{name:'Enlace o ID de GIPHY'}).fill('https://giphy.com/gifs/demo-42');
    await formPage.getByRole('button',{name:'Añadir GIF'}).click();
    await formPage.getByText('GIF añadido.',{exact:false}).waitFor();
    await formPage.close();
    await page.goto('https://github.com/jatogifs/test/pull/1');
    await open(); await picker.locator('.gif').first().waitFor();
    await picker.getByRole('button',{name:'Cargar más',exact:true}).click();
    const added = picker.getByRole('button',{name:'Insertar GIF 28'});
    await added.waitFor();
    await added.click();
    assert.equal(await editor.inputValue(),'![GIF de GIPHY](<https://media.giphy.com/media/42/giphy.gif>)');
    assert.deepEqual(apiRequests, [],'extension must not call the GIPHY API');
    assert.deepEqual(errors, []);
    const report = { browser: executablePath, version:context.browser()?.version(), status:'passed', scenarios:['extension iframe + restrictive page CSP','keyboard insertion','native undo','middle insertion','other drafts preserved','keyboard focus and pagination','light/dark','draft cancellation','empty/offline and retry','image fallback and inaccessible image','add through public website','excluded code editor','dynamic editor','zoom','page navigation'], catalogue:'Worker with local SQLite', media:'mocked', github:'mocked', screenshots:artifactDir };
    fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await context.close(); fs.rmSync(profile,{recursive:true,force:true}); }
})().catch(error => { console.error(error); process.exitCode=1; });
