import { isAdmin } from './access.mjs';
import { adminPage } from './admin.mjs';

const MAX_GIFS = 100;
const SITE = 'https://jato.sediles.dev';

export function parseId(entry) {
  const text = entry.trim();
  if (/^[A-Za-z0-9]{1,64}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !['giphy.com', 'www.giphy.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
    const name = url.pathname.match(/^\/(?:gifs|embed)\/([^/]+)\/?$/)?.[1];
    const id = name?.split('-').at(-1);
    return id && /^[A-Za-z0-9]{1,64}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function list(db) {
  const { results } = await db.prepare('SELECT id FROM gifs ORDER BY position LIMIT ?').bind(MAX_GIFS).all();
  return results.map(({ id }) => id);
}

async function readForm(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return new URLSearchParams(text + decoder.decode());
    bytes += value.byteLength;
    if (bytes > 2048) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

function plain(body, status) {
  return new Response(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

const messages = { added: 'GIF añadido. Vuelve a abrir /gif para verlo.', removed: 'GIF quitado del catálogo.' };

export function createWorker(checkAdmin = isAdmin) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.origin !== SITE) return plain('No encontrado.', 404);
      const { pathname } = url;
      const { method } = request;
      try {
        if (pathname === '/' && method === 'GET') return new Response(null, { status: 302, headers: { Location: '/admin', 'Cache-Control': 'no-store' } });
        if (pathname === '/api/catalog' && method === 'GET') {
          return Response.json({ version: 1, ids: await list(env.CATALOG_DB) }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
        if (pathname !== '/admin' || !['GET', 'POST'].includes(method)) return plain('No encontrado.', 404);
        if (!await checkAdmin(request, env)) return plain('Acceso restringido.', 403);
        if (method === 'GET') {
          const status = url.searchParams.get('status');
          return adminPage(await list(env.CATALOG_DB), Object.hasOwn(messages, status) ? messages[status] : '');
        }

        if (request.headers.get('Origin') !== SITE) return plain('Origen no permitido.', 403);
        if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return plain('Formato no permitido.', 415);
        const form = await readForm(request);
        if (!form) return plain('Solicitud demasiado grande.', 413);
        const id = parseId(form.get('gif') || '');
        const action = form.get('action');
        if (!id || !['add', 'remove'].includes(action)) return adminPage(await list(env.CATALOG_DB), 'Introduce el enlace de un GIF en giphy.com o su ID.', 400);
        if (action === 'add') {
          const { meta } = await env.CATALOG_DB.prepare(
            'INSERT INTO gifs (id) SELECT ? WHERE (SELECT count(*) FROM gifs) < ? ON CONFLICT(id) DO NOTHING'
          ).bind(id, MAX_GIFS).run();
          if (meta.changes === 0) {
            const ids = await list(env.CATALOG_DB);
            return adminPage(ids, ids.includes(id) ? 'Ese GIF ya está en el catálogo.' : 'El catálogo admite hasta 100 GIF. Quita uno antes de añadir otro.', 409);
          }
        } else {
          await env.CATALOG_DB.prepare('DELETE FROM gifs WHERE id = ?').bind(id).run();
        }
        return new Response(null, { status: 303, headers: { Location: '/admin?status=' + (action === 'add' ? 'added' : 'removed'), 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.error({ event: 'catalog_request_failed', route: pathname, error: error.name });
        return plain('El catálogo no está disponible. Vuelve a intentarlo.', 503);
      }
    },
  };
}

export default createWorker();
