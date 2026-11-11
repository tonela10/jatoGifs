(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JatoCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EXTRA_GIF_ID = 'o5usW6VUC2TkUrC42m';
  const EXTRA_GIF = Object.freeze({ username: 'perekng', title: 'Test production testing' });
  const DEFAULT_IDS = Object.freeze(['S1mnD1JJvbNl5Yp2FN', '5IxLXhAioF7MV3TRec', 'YmG7tIiaOy4vgsY7A7', 'NyheNMWf1qG4QIfvHG', '6CYUbhoSWNinbJMiA2', 'YIAfyCYgIeVVp3Ce1Q', 'V89UvJ0KUhkZAiYyxp', 'Ek3jh2eKxtI0iZktnB', EXTRA_GIF_ID]);
  function validate(ids) {
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error('La colección admite hasta 100 ID de GIPHY distintos, con letras y números.');
    }
    return [...ids];
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > 40000) throw new Error('La lista de GIF es demasiado larga.');
    const entries = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const ids = entries.map((entry, index) => {
      if (/^[A-Za-z0-9]{1,64}$/.test(entry)) return entry;
      try {
        const url = new URL(entry);
        if (url.protocol !== 'https:' || !['giphy.com', 'www.giphy.com'].includes(url.hostname) || url.username || url.password || url.port) throw new Error();
        const match = url.pathname.match(/^\/(?:gifs|embed)\/([^/]+)\/?$/);
        if (!match) throw new Error();
        const id = match[1].split('-').pop();
        if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new Error();
        return id;
      } catch { throw new Error(`Línea ${index + 1}: pega el enlace de la página del GIF en giphy.com o su ID.`); }
    });
    return validate([...new Set(ids)]);
  }
  function extraGif(id) { return id === EXTRA_GIF_ID ? EXTRA_GIF : undefined; }
  return Object.freeze({ DEFAULT_IDS, extraGif, validate, parse });
});
