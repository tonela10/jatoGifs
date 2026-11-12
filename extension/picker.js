'use strict';
const parameters = new URLSearchParams(location.hash.slice(1));
const session = parameters.get('session');
document.documentElement.dataset.theme = parameters.get('theme') === 'dark' ? 'dark' : 'light';
const grid = document.querySelector('#grid');
const status = document.querySelector('#status');
const more = document.querySelector('#more');
const retry = document.querySelector('#retry');
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
    const result = await send('SELECT', { id: gif.id });
    if (!result?.ok) { showError(result?.error?.message || 'No se pudo insertar. Cierra y abre el selector.'); selecting = false; }
  } catch { selecting = false; showError('El selector se ha desconectado. Cierra y vuelve a escribir /gif.'); }
}
function mark(index, focus = false, direction = 1) {
  const enabled = buttons.map((button, i) => button.disabled ? -1 : i).filter(i => i >= 0);
  selectedIndex = (direction < 0
    ? enabled.findLast(i => i <= index) ?? enabled[0]
    : enabled.find(i => i >= index) ?? enabled.at(-1)) ?? -1;
  buttons.forEach((button, i) => {
    button.dataset.selected = String(i === selectedIndex);
    button.tabIndex = i === selectedIndex ? 0 : -1;
  });
  const selected = buttons[selectedIndex];
  document.getElementById('selection-status').textContent = selected?.getAttribute('aria-label') ?? '';
  if (!selected) {
    if (focus) document.getElementById('main').focus();
    return;
  }
  selected.scrollIntoView({ block: 'nearest' });
  if (focus) selected.focus();
}

function addGif(gif) {
  const number = buttons.length + 1;
  const title = `GIF ${number}`;
  const button = document.createElement('button');
  button.className = 'gif'; button.type = 'button'; button.title = title; button.tabIndex = -1;
  button.setAttribute('aria-label', `Insertar ${title}`);
  const img = document.createElement('img');
  img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
  const label = document.createElement('span');
  label.className = 'gif-caption'; label.textContent = title;
  let triedOriginal = false;
  img.addEventListener('error', () => {
    if (!triedOriginal) {
      triedOriginal = true;
      img.src = gif.url;
      return;
    }
    const hadFocus = document.activeElement === button;
    img.hidden = true;
    button.disabled = true;
    button.classList.add('image-error');
    label.textContent = `${title} no disponible`;
    button.title = label.textContent;
    button.setAttribute('aria-label', label.textContent);
    if (buttons[selectedIndex] === button) mark(selectedIndex, hadFocus);
  });
  img.src = gif.preview;
  button.append(img, label);
  button.addEventListener('click', () => { if (!button.disabled) void select(gif); });
  button.addEventListener('focus', () => mark(buttons.indexOf(button)));
  buttons.push(button);
  grid.append(button);
}

async function load() {
  if (loading) return;
  loading = true; grid.setAttribute('aria-busy', 'true');
  more.disabled = true; retry.hidden = true;
  status.hidden = false; status.textContent = offset ? 'Cargando más GIF…' : 'Cargando tu colección…';
  try {
    const result = await send('PAGE', { offset });
    if (!result?.ok) {
      const code = result?.error?.code;
      showError(result?.error?.message || 'No se pudo conectar. Cierra y vuelve a abrir el selector.');
      retry.hidden = code === 'SESSION';
      more.hidden = true;
      return;
    }
    for (const gif of result.items) addGif(gif);
    offset = result.nextOffset; more.hidden = !result.hasMore;
    status.hidden = buttons.length > 0;
    if (!buttons.length) status.textContent = 'El catálogo está vacío. Añade un GIF desde la web.';
    mark(Math.max(0, selectedIndex), document.activeElement.id === 'main');
  } catch { showError('No se pudo conectar con la extensión. Cierra y vuelve a escribir /gif.'); more.hidden = true; }
  finally { loading = false; more.disabled = false; grid.setAttribute('aria-busy', 'false'); }
}
function navigate(key, focus = false) {
  if (key === 'Escape') { void send('DISMISS'); return; }
  if (selectedIndex < 0 || selecting) return;
  if (key === 'Enter') { buttons[selectedIndex].click(); return; }
  const step = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: step, ArrowUp: -step }[key];
  if (delta !== undefined) mark(Math.max(0, Math.min(buttons.length - 1, selectedIndex + delta)), focus, Math.sign(delta));
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
document.getElementById('settings').addEventListener('click', () => send('OPTIONS'));
retry.addEventListener('click', load); more.addEventListener('click', load);
void load();
