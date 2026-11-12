'use strict';
const parameters = new URLSearchParams(location.hash.slice(1));
const session = parameters.get('session');
document.documentElement.dataset.theme = parameters.get('theme') === 'dark' ? 'dark' : 'light';
const grid = document.querySelector('#grid');
const status = document.querySelector('#status');
const more = document.querySelector('#more');
const retry = document.querySelector('#retry');
const configure = document.querySelector('#configure');
let offset = 0;
let loading = false;
let selecting = false;
let selectedIndex = 0;
let buttons = [];

function send(type, data = {}) { return chrome.runtime.sendMessage({ type, session, ...data }); }
function showError(message) { status.hidden = false; status.textContent = message; }
async function select(gif) {
  if (selecting) return;
  selecting = true;
  try {
    const result = await send('SELECT', { gif: { title: gif.title, url: gif.url } });
    if (!result?.ok) { showError(result?.error?.message || 'No se pudo insertar. Cierra y abre el selector.'); selecting = false; }
  } catch { selecting = false; showError('El selector se ha desconectado. Cierra y vuelve a escribir /gif.'); }
}
function mark(index, focus = false) {
  if (!buttons.length) return;
  selectedIndex = Math.max(0, Math.min(index, buttons.length - 1));
  buttons.forEach((button, i) => { button.dataset.selected = String(i === selectedIndex); button.tabIndex = i === selectedIndex ? 0 : -1; });
  buttons[selectedIndex].scrollIntoView({ block: 'nearest' });
  document.getElementById('selection-status').textContent = buttons[selectedIndex].getAttribute('aria-label');
  if (focus) buttons[selectedIndex].focus();
}
async function load() {
  if (loading) return;
  loading = true; grid.setAttribute('aria-busy', 'true');
  more.disabled = true; retry.hidden = true; configure.hidden = true;
  status.hidden = false; status.textContent = offset ? 'Cargando más GIF…' : 'Cargando tu colección…';
  try {
    const result = await send('PAGE', { offset });
    if (!result?.ok) {
      const code = result?.error?.code;
      showError(result?.error?.message || 'No se pudo conectar. Cierra y vuelve a abrir el selector.');
      configure.hidden = !['NOT_CONFIGURED', 'KEY'].includes(code);
      retry.hidden = ['NOT_CONFIGURED', 'KEY', 'SESSION'].includes(code);
      more.hidden = true;
      return;
    }
    for (const gif of result.items) {
      const button = document.createElement('button');
      button.className = 'gif'; button.type = 'button'; button.title = gif.title;
      button.setAttribute('aria-label', `Insertar ${gif.title}${gif.username ? `, de @${gif.username}` : ''}`);
      const img = document.createElement('img');
      img.src = gif.preview; img.alt = gif.title; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { img.hidden = true; button.classList.add('image-error'); });
      const label = document.createElement('span'); label.className = 'gif-caption'; label.textContent = gif.title;
      button.append(img, label);
      button.addEventListener('click', () => select(gif));
      button.addEventListener('focus', () => mark(buttons.indexOf(button)));
      grid.append(button); buttons.push(button);
    }
    offset = result.nextOffset; more.hidden = !result.hasMore;
    status.hidden = buttons.length > 0 && !result.missingIds?.length;
    if (result.missingIds?.length) status.textContent = 'Algunos GIF del catálogo no están disponibles en GIPHY.';
    else if (!buttons.length) status.textContent = 'El catálogo está vacío. Puedes gestionarlo desde Configuración.';
    configure.hidden = buttons.length > 0;
    mark(selectedIndex, document.activeElement.id === 'main');
  } catch { showError('No se pudo conectar con la extensión. Cierra y vuelve a escribir /gif.'); more.hidden = true; }
  finally { loading = false; more.disabled = false; grid.setAttribute('aria-busy', 'false'); }
}
function navigate(key, focus = false) {
  if (key === 'Escape') { void send('DISMISS'); return; }
  if (!buttons.length || selecting) return;
  if (key === 'Enter') { buttons[selectedIndex].click(); return; }
  const step = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: step, ArrowUp: -step }[key];
  if (delta !== undefined) mark(selectedIndex + delta, focus);
}
addEventListener('message', event => {
  if (event.origin !== 'https://github.com' || event.source !== parent || event.data?.session !== session) return;
  if (event.data.type === 'JATO_FOCUS') {
    if (buttons.length) mark(selectedIndex, true); else document.getElementById('main').focus();
  } else if (event.data.type === 'JATO_KEY') navigate(event.data.key, true);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); void send('DISMISS'); }
  else if (event.target.closest('.gif') && ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); navigate(event.key, true); }
});
document.querySelector('#close').addEventListener('click', () => send('DISMISS'));
for (const id of ['settings', 'configure']) document.getElementById(id).addEventListener('click', () => send('OPTIONS'));
retry.addEventListener('click', load); more.addEventListener('click', load);
void load();
