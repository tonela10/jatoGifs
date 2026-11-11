'use strict';
importScripts('config.js', 'catalog.js', 'giphy.js', 'core.js');
// Only the app key and user-selected GIF IDs are saved locally.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
// Only routing metadata lives in session storage. It survives worker suspension,
// but never contains GIFs, media URLs, keys or drafts and is cleared on close.
const inFlight = new Set();
const sessionKey = id => `picker:${id}`;
async function getSession(id) { return (await chrome.storage.session.get(sessionKey(id)))[sessionKey(id)]; }
async function removeSession(id) { await chrome.storage.session.remove(sessionKey(id)); }
const pickerUrl = chrome.runtime.getURL('picker.html');
const optionsUrl = chrome.runtime.getURL('options.html');
const failure = (code, message) => ({ ok: false, error: { code, message } });

async function key() {
  const saved = await chrome.storage.local.get('apiKey');
  return saved.apiKey || self.JATO_CONFIG.apiKey;
}
async function collection() {
  const saved = await chrome.storage.local.get('gifIds');
  return JatoCatalog.validate(saved.gifIds === undefined ? JatoCatalog.DEFAULT_IDS : saved.gifIds);
}

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
        const page = await JatoGiphy.fetchPage(await key(), message.offset, fetch, await collection());
        if (!(await getSession(message.session))) return failure('SESSION', 'El selector se ha cerrado.');
        return { ok: true, ...page };
      } finally { inFlight.delete(message.session); }
    }
    if (message.type === 'SELECT' && isPicker) {
      const entry = await getSession(message.session);
      const gif = message.gif;
      if (!entry || entry.tabId !== sender.tab?.id) return failure('SESSION', 'El editor ya no está disponible. Abre el selector de nuevo.');
      if (!gif || !JatoCore.safeMediaUrl(gif.url) || typeof gif.title !== 'string') return failure('SERVICE', 'El GIF no tiene una URL válida.');
      await chrome.tabs.sendMessage(entry.tabId, { type: 'SELECT', session: message.session, gif: { title: gif.title, url: gif.url } }, { frameId: 0 });
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
      const ids = await collection();
      const page = await JatoGiphy.fetchByIds(await key(), ids);
      return { ok: true, count: page.items.length, requested: ids.length, missingIds: page.missingIds };
    }
    if (message.type === 'SAVE_COLLECTION' && isOptions) {
      let ids;
      try { ids = JatoCatalog.parse(message.entries); }
      catch (error) { return failure('IDS', error.message); }
      const page = await JatoGiphy.fetchByIds(await key(), ids);
      if (page.missingIds.length) return failure('MISSING_IDS', `No se ha cambiado tu colección: GIPHY no devuelve estos ID: ${page.missingIds.join(', ')}.`);
      await chrome.storage.local.set({ gifIds: ids });
      return { ok: true, count: ids.length, ids };
    }
    return failure('DENIED', 'Acción no permitida.');
  })().then(reply, error => reply(failure(error.code || 'SERVICE', error.code ? error.message : 'No se pudo completar la acción. Cierra y vuelve a abrir el selector.')));
  return true;
});
chrome.tabs.onRemoved.addListener(async tabId => {
  const entries = await chrome.storage.session.get(null);
  for (const [id, entry] of Object.entries(entries)) if (id.startsWith('picker:') && entry.tabId === tabId) await chrome.storage.session.remove(id);
});
