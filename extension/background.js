'use strict';
importScripts('catalog.js');
// Legacy local lists remain available in options.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
// A picker session keeps its catalogue IDs stable across pages and worker suspension.
// Session storage never contains media URLs, keys or drafts and is cleared on close.
const inFlight = new Set();
const sessionKey = id => `picker:${id}`;
async function getSession(id) { return (await chrome.storage.session.get(sessionKey(id)))[sessionKey(id)]; }
async function removeSession(id) { await chrome.storage.session.remove(sessionKey(id)); }
const pickerUrl = chrome.runtime.getURL('picker.html');
const optionsUrl = chrome.runtime.getURL('options.html');
const failure = (code, message) => ({ ok: false, error: { code, message } });

// Reloading an unpacked extension does not always emit an update event.
void chrome.storage.local.remove('apiKey').catch(() => {
  console.warn('No se pudo borrar la antigua clave local de jatoGifs.');
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const isPicker = sender.url?.split('#')[0] === pickerUrl;
  const isOptions = sender.url?.split('#')[0] === optionsUrl;
  const isContent = sender.tab && sender.frameId === 0 && sender.url?.startsWith('https://github.com/');
  if (!message || typeof message.type !== 'string') return false;
  (async () => {
    if (message.type === 'OPEN' && isContent && typeof message.session === 'string' && /^[a-f0-9-]{36}$/.test(message.session)) {
      const entries = await chrome.storage.session.get(null);
      for (const [id, entry] of Object.entries(entries)) if (id.startsWith('picker:') && (entry.tabId === sender.tab.id || Date.now() - entry.created > 30 * 60 * 1000)) await chrome.storage.session.remove(id);
      await chrome.storage.session.set({ [sessionKey(message.session)]: { tabId: sender.tab.id, created: Date.now() } });
      return { ok: true };
    }
    if (message.type === 'CLOSE' && isContent) {
      if ((await getSession(message.session))?.tabId === sender.tab.id) await removeSession(message.session);
      return { ok: true };
    }
    if (message.type === 'PAGE' && isPicker) {
      const entry = await getSession(message.session);
      if (!entry || entry.tabId !== sender.tab?.id) return failure('SESSION', 'El editor ya no está disponible. Cierra y vuelve a escribir /gif.');
      if (inFlight.has(message.session)) return failure('BUSY', 'Ya se están cargando los GIF.');
      inFlight.add(message.session);
      try {
        const ids = entry.ids ?? (message.offset === 0 ? await JatoCatalog.load() : null);
        if (ids === null) return failure('SESSION', 'Cierra y vuelve a escribir /gif para actualizar el catálogo.');
        if (!(await getSession(message.session))) return failure('SESSION', 'El selector se ha cerrado.');
        if (entry.ids === undefined) await chrome.storage.session.set({ [sessionKey(message.session)]: { ...entry, ids } });
        return { ok: true, ...JatoCatalog.page(ids, message.offset) };
      } finally { inFlight.delete(message.session); }
    }
    if (message.type === 'SELECT' && isPicker) {
      const entry = await getSession(message.session);
      if (!entry || entry.tabId !== sender.tab?.id) return failure('SESSION', 'El editor ya no está disponible. Abre el selector de nuevo.');
      if (!entry.ids?.includes(message.id)) return failure('GIF', 'Ese GIF no pertenece al catálogo abierto.');
      const { url } = JatoCatalog.media(message.id);
      await chrome.tabs.sendMessage(entry.tabId, { type: 'SELECT', session: message.session, gif: { title: 'GIF de GIPHY', url } }, { frameId: 0 });
      await removeSession(message.session);
      return { ok: true };
    }
    if (message.type === 'DISMISS' && isPicker) {
      const entry = await getSession(message.session);
      if (entry && entry.tabId === sender.tab?.id) {
        await chrome.tabs.sendMessage(entry.tabId, { type: 'DISMISS', session: message.session }, { frameId: 0 });
        await removeSession(message.session);
      }
      return { ok: true };
    }
    if (message.type === 'OPTIONS' && isPicker) { await chrome.runtime.openOptionsPage(); return { ok: true }; }
    if (message.type === 'CHECK' && isOptions) {
      const ids = await JatoCatalog.load();
      return { ok: true, count: ids.length };
    }
    return failure('DENIED', 'Acción no permitida.');
  })().then(reply, error => reply(failure(error.code || 'SERVICE', error.code ? error.message : 'No se pudo completar la acción. Cierra y vuelve a abrir el selector.')));
  return true;
});
chrome.tabs.onRemoved.addListener(async tabId => {
  const entries = await chrome.storage.session.get(null);
  for (const [id, entry] of Object.entries(entries)) if (id.startsWith('picker:') && entry.tabId === tabId) await chrome.storage.session.remove(id);
});
