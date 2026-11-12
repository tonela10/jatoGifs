'use strict';
const collectionResult = document.getElementById('collection-result');
function collectionReport(text, error = false) { collectionResult.textContent = text; collectionResult.dataset.error = String(error); }

chrome.storage.local.get('gifIds').then(({ gifIds }) => {
  if (!Array.isArray(gifIds) || !gifIds.length) return;
  document.getElementById('legacy-entries').value = JatoCatalog.validate(gifIds).map(id => `https://giphy.com/gifs/${id}`).join('\n');
  document.getElementById('legacy-collection').hidden = false;
}).catch(() => collectionReport('No se pudo leer la antigua colección local.', true));

document.getElementById('check').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  collectionReport('Comprobando el catálogo…');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK' });
    if (!response?.ok) { collectionReport(response?.error?.message || 'No se pudo comprobar el catálogo.', true); return; }
    collectionReport(`Conexión correcta: ${response.count} ${response.count === 1 ? 'entrada' : 'entradas'} en el catálogo.`);
  } catch { collectionReport('La extensión se ha desconectado. Reabre Configuración.', true); }
  finally { button.disabled = false; }
});
