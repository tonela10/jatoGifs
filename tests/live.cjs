// Optional live API smoke test: real GIPHY, isolated browser, synthetic GitHub editor.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {load}=require('../extension/catalog.js');
const addedId='o5usW6VUC2TkUrC42m';
const extension=path.resolve(__dirname,'../extension');
const artifacts=process.env.JATO_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(),'jatogifs-live-evidence-'));
fs.mkdirSync(artifacts,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'jatogifs-live-profile-'));
(async()=>{
 const ids=await load();
 const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.JATO_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',headless:true,viewport:{width:1200,height:950},ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--disable-brave-update']});
 try {
  await context.route('https://github.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es" data-color-mode="light"><head><meta charset="utf-8"><title>jatoGifs · prueba con API real</title><style>body{max-width:800px;margin:50px auto;padding:0 24px;color:#1f2328;font:16px/1.5 system-ui}h1{font-size:26px}textarea{width:100%;height:150px;box-sizing:border-box;padding:14px;font:inherit;border:1px solid #d1d9e0;border-radius:6px}label{display:block;margin:20px 0 8px}p{color:#59636e}</style></head><body><h1>jatoGifs: GIF reales de tonela10</h1><p>Prueba aislada con un editor sintético. Los GIF se consultan en la API real de GIPHY; no se publica nada en GitHub.</p><p id="proof" role="status"></p><label for="comment_body">Borrador de prueba</label><textarea name="comment[body]" id="comment_body"></textarea></body></html>'}));
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  const options=await context.newPage(); await options.goto(`chrome-extension://${id}/options.html`);
  if (process.env.GIPHY_API_KEY) {
   await options.locator('#api-key').fill(process.env.GIPHY_API_KEY);
   await options.getByRole('button',{name:'Guardar clave',exact:true}).click();
   await options.locator('#result').filter({hasText:'Clave guardada.'}).waitFor();
  }
  await options.getByRole('button',{name:'Comprobar GIF',exact:true}).click();
  await options.locator('#collection-result').filter({hasText:`Conexión correcta: ${ids.length} de ${ids.length} GIF disponibles.`}).waitFor({timeout:25000});
  const page=await context.newPage(); await page.goto('https://github.com/jatogifs/live-test/issues/new');
  const editor=page.locator('#comment_body'); await editor.fill('/gif');
  const picker=page.frameLocator('#jatogifs-picker');
  await picker.locator('.gif').nth(ids.length - 1).waitFor({timeout:25000});
  assert.equal(await picker.locator('.gif').count(),ids.length);
  const frame=page.frames().find(frame=>frame.url().startsWith(`chrome-extension://${id}/picker.html`));
  await frame.locator('.gif img').evaluateAll(images=>images.forEach(img=>{img.loading='eager';}));
  await frame.waitForFunction(()=>[...document.querySelectorAll('.gif img')].every(img=>img.complete&&img.naturalWidth>0),{timeout:30000});
  await page.locator('#proof').evaluate((el,count)=>{el.textContent=`Comprobación correcta: ${count} de ${count} GIF disponibles e imágenes cargadas.`;},ids.length);
  await page.screenshot({path:path.join(artifacts,'gallery-live.png'),fullPage:true});
  await picker.getByRole('button',{name:/Insertar .+, de @perekng/}).click();
  assert.match(await editor.inputValue(),/^!\[.+\]\(<https:\/\/(?:[^/]+\.)?giphy\.com\//);
  assert.ok((await editor.inputValue()).includes(addedId));
  const report={status:'passed',version:JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'))).version,api:`real GIPHY, ${ids.length}/${ids.length} GIF, all preview images loaded`,github:'synthetic isolated editor; no comment published',insertion:`GIF ${addedId} inserted as Markdown`,screenshots:artifacts};
  fs.writeFileSync(path.join(artifacts,'live-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
