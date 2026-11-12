(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JatoCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const URL = 'https://jato.sediles.dev/api/catalog';

  const PAGE_SIZE = 25;
  const MEDIA = 'https://media.giphy.com/media';
  const isId = id => typeof id === 'string' && /^[A-Za-z0-9]{1,64}$/.test(id);

  function validate(ids) {
    if (!Array.isArray(ids) || ids.length > 100 || Array.from(ids).some(id => !isId(id)) || new Set(ids).size !== ids.length) {
      throw new Error('La colección admite hasta 100 ID de GIPHY distintos, con letras y números.');
    }
    return [...ids];
  }

  async function load(fetcher = fetch) {
    try {
      const response = await fetcher(URL, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) throw new Error();
      const { version, ids } = await response.json();
      if (version !== 1) throw new Error();
      return validate(ids);
    } catch {
      const error = new Error('No se pudo cargar el catálogo de jatoGifs. Comprueba la conexión y vuelve a intentarlo.');
      error.code = 'CATALOG';
      throw error;
    }
  }

  function media(id) {
    if (!isId(id)) throw new Error('ID de GIF no válido.');
    return { id, preview: `${MEDIA}/${id}/200w.gif`, url: `${MEDIA}/${id}/giphy.gif` };
  }

  function page(ids, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > ids.length) {
      throw Object.assign(new Error('No se pueden cargar más resultados.'), { code: 'OFFSET' });
    }
    const items = ids.slice(offset, offset + PAGE_SIZE).map(media);
    const nextOffset = offset + items.length;
    return { items, nextOffset, hasMore: nextOffset < ids.length };
  }

  return Object.freeze({ URL, load, validate, media, page });
});
