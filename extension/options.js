'use strict';
const input = document.getElementById('api-key');
const result = document.getElementById('result');
const collectionResult = document.getElementById('collection-result');
function report(text, error = false) { result.textContent = text; result.dataset.error = String(error); }
function collectionReport(text, error = false) { collectionResult.textContent = text; collectionResult.dataset.error = String(error); }
chrome.storage.local.get(['apiKey', 'gifIds']).then(data => {
  input.value = data.apiKey || '';
  if (Array.isArray(data.gifIds) && data.gifIds.length) {
    document.getElementById('legacy-entries').value = JatoCatalog.validate(data.gifIds).map(id => `https://giphy.com/gifs/${id}`).join('\n');
    document.getElementById('legacy-collection').hidden = false;
  }
}).catch(() => report('No se pudo leer la configuración. Reabre esta página.', true));
document.getElementById('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const value = input.value.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) { report('Introduce una API Key válida, sin espacios.', true); return; }
  try { await chrome.storage.local.set({ apiKey: value }); report('Clave guardada. Pulsa «Comprobar GIF» para validar el acceso.'); }
  catch { report('No se pudo guardar la clave. Inténtalo de nuevo.', true); }
});
document.getElementById('check').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; collectionReport('Comprobando el catálogo y GIPHY…');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK' });
    if (!response?.ok) { collectionReport(response?.error?.message || 'No se pudo comprobar la colección.', true); return; }
    collectionReport(response.missingIds.length ? `${response.count} de ${response.requested} GIF disponibles. GIPHY ya no devuelve estos ID: ${response.missingIds.join(', ')}.` : `Conexión correcta: ${response.count} de ${response.requested} GIF disponibles.`, response.missingIds.length > 0);
  } catch { collectionReport('La extensión se ha desconectado. Reabre Configuración.', true); }
  finally { button.disabled = false; }
});
document.getElementById('remove').addEventListener('click', async () => {
  try { await chrome.storage.local.remove('apiKey'); input.value = ''; report('Clave local borrada. Se usará la clave incluida en la extensión, si existe.'); }
  catch { report('No se pudo borrar la clave. Inténtalo de nuevo.', true); }
});
