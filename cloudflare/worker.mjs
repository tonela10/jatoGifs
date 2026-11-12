import { isAdmin } from './access.mjs';
import { cataloguePage } from './admin.mjs';

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

export async function verifyGif(id, fetcher = globalThis.fetch.bind(globalThis)) {
  const url = new URL('https://giphy.com/services/oembed');
  url.searchParams.set('url', `https://giphy.com/gifs/${id}`);
  const response = await fetcher(url, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(6000),
  });
  if ([400, 403, 404, 410].includes(response.status) || (response.status >= 300 && response.status < 400)) return false;
  if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    const error = new Error('GIPHY availability check failed');
    error.upstreamStatus = response.status;
    throw error;
  }
  return true;
}

function redirect(location, status = 303) {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export function createWorker({ checkAdmin = isAdmin, checkGif = verifyGif } = {}) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.origin !== SITE) return plain('No encontrado.', 404);
      const { pathname } = url;
      const { method } = request;
      const manage = pathname === '/manage';
      const page = async (message = '', status = 200) => cataloguePage(await list(env.CATALOG_DB), { message, status, manage });
      try {
        if (pathname === '/admin' && method === 'GET') return redirect('/', 302);
        if (pathname === '/api/catalog' && method === 'GET') {
          return Response.json({ version: 1, ids: await list(env.CATALOG_DB) }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
        if ((!manage && pathname !== '/') || !['GET', 'POST'].includes(method)) return plain('No encontrado.', 404);
        if (manage && !await checkAdmin(request, env, undefined, ctx)) return plain('Inicia sesión en Cloudflare Access con el correo autorizado para administrar el catálogo.', 403);
        if (method === 'GET') {
          const status = url.searchParams.get('status');
          return page(Object.hasOwn(messages, status) ? messages[status] : '');
        }
        if (request.headers.get('Origin') !== SITE) return plain('Origen no permitido.', 403);
        if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return plain('Formato no permitido.', 415);
        if (!manage) {
          const key = request.headers.get('CF-Connecting-IP');
          if (!key || !env.ADD_RATE_LIMIT) return plain('No se pueden añadir GIF en este momento.', 503);
          if (!(await env.ADD_RATE_LIMIT.limit({ key })).success) return page('Demasiados intentos. Espera un minuto y vuelve a probar.', 429);
        }
        const form = await readForm(request);
        if (!form) return plain('Solicitud demasiado grande.', 413);
        const id = parseId(form.get('gif') || '');
        const action = form.get('action');
        if (!id) return page('Introduce el enlace de un GIF en giphy.com o su ID.', 400);
        if (manage) {
          if (action !== 'remove') return plain('Acción no permitida.', 400);
          await env.CATALOG_DB.prepare('DELETE FROM gifs WHERE id = ?').bind(id).run();
          return redirect('/manage?status=removed');
        }
        if (action !== null) return plain('Acción no permitida.', 400);
        try {
          if (!await checkGif(id)) return page('GIPHY no confirma que ese GIF sea público. Revisa el enlace.', 422);
        } catch (error) {
          console.error({ event:'gif_lookup_failed', reason:error.name, upstreamStatus:error.upstreamStatus });
          return page('No pudimos comprobar el GIF en GIPHY. Inténtalo de nuevo.', 503);
        }
        const { meta } = await env.CATALOG_DB.prepare(
          'INSERT INTO gifs (id) SELECT ? WHERE (SELECT count(*) FROM gifs) < ? ON CONFLICT(id) DO NOTHING'
        ).bind(id, MAX_GIFS).run();
        if (meta.changes === 0) {
          const ids = await list(env.CATALOG_DB);
          return cataloguePage(ids, { message: ids.includes(id) ? 'Ese GIF ya está en el catálogo.' : 'El catálogo admite hasta 100 GIF. Pide al propietario que quite alguno.', status: 409 });
        }
        return redirect('/?status=added');
      } catch (error) {
        console.error({ event: 'catalog_request_failed', route: pathname, error: error.name });
        return plain('El catálogo no está disponible. Vuelve a intentarlo.', 503);
      }
    },
  };
}

export default createWorker();
