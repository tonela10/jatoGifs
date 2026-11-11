(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./catalog.js') : root.JatoCatalog);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JatoGiphy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (catalog) {
  'use strict';
  const LIMIT = 25;
  class GiphyError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  function errorForStatus(status) {
    if (status === 401 || status === 403) return new GiphyError('KEY', 'La clave de GIPHY no es válida o no tiene acceso. Revísala en Configuración.');
    if (status === 429) return new GiphyError('RATE_LIMIT', 'Se ha alcanzado el límite de GIPHY. Espera antes de volver a intentarlo.');
    return new GiphyError('SERVICE', 'GIPHY no está disponible. Vuelve a intentarlo más tarde.');
  }
  function isMediaUrl(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && /(^|\.)giphy\.com$/.test(u.hostname); }
    catch { return false; }
  }
  async function fetchByIds(apiKey, ids, fetcher = fetch, channel = 'tonela10') {
    try { ids = catalog.validate(ids); }
    catch (error) { throw new GiphyError('IDS', error.message); }
    if (!ids.length) return { items: [], missingIds: [] };
    if (!apiKey) throw new GiphyError('NOT_CONFIGURED', 'Guarda una clave de GIPHY en Configuración para ver los GIF.');
    const url = new URL('https://api.giphy.com/v1/gifs');
    url.search = new URLSearchParams({ api_key: apiKey, ids: ids.join(',') });
    let response;
    try { response = await fetcher(url.href, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000) }); }
    catch { throw new GiphyError('NETWORK', 'No se pudo conectar con GIPHY. Comprueba tu conexión y reintenta.'); }
    if (!response.ok) throw errorForStatus(response.status);
    let payload;
    try { payload = await response.json(); }
    catch { throw new GiphyError('SERVICE', 'GIPHY ha devuelto una respuesta no válida. Reintenta.'); }
    if (payload.meta?.status && payload.meta.status !== 200) throw errorForStatus(payload.meta.status);
    if (!Array.isArray(payload.data) || !payload.meta?.response_id) {
      throw new GiphyError('SERVICE', 'GIPHY no ha podido devolver el catálogo. Reintenta.');
    }
    const returnedIds = payload.data.map(gif => gif.id);
    if (returnedIds.some(id => !ids.includes(id)) || new Set(returnedIds).size !== returnedIds.length) throw new GiphyError('SERVICE', 'GIPHY devolvió identificadores inesperados. Reintenta.');
    // Allow the channel and the explicitly selected external GIF only.
    const items = payload.data.map(gif => {
      const username = gif.username || gif.user?.username || '';
      const extra = catalog.extraGif(gif.id);
      if (username.toLowerCase() !== (extra?.username || channel.toLowerCase())) {
        throw new GiphyError('CHANNEL', 'La colección incluye un GIF de otro canal que no está permitido. Revisa los enlaces en Configuración.');
      }
      const url = gif.images?.original?.url;
      const preview = gif.images?.fixed_width?.url || gif.images?.fixed_height?.url || url;
      if (!isMediaUrl(url) || !isMediaUrl(preview)) throw new GiphyError('SERVICE', 'GIPHY devolvió un GIF sin una URL válida. Reintenta.');
      return { id: gif.id, title: gif.title || extra?.title || 'GIF de tonela10', url, preview, username };
    });
    return { items, missingIds: ids.filter(id => !returnedIds.includes(id)) };
  }
  async function fetchPage(apiKey, offset = 0, fetcher = fetch, ids = catalog.DEFAULT_IDS) {
    try { ids = catalog.validate(ids); }
    catch (error) { throw new GiphyError('IDS', error.message); }
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > ids.length) throw new GiphyError('OFFSET', 'No se pueden cargar más resultados.');
    const requested = ids.slice(offset, offset + LIMIT);
    const result = await fetchByIds(apiKey, requested, fetcher);
    const next = offset + requested.length;
    return { ...result, nextOffset: next, hasMore: next < ids.length };
  }
  return { fetchByIds, fetchPage, GiphyError, LIMIT };
});
