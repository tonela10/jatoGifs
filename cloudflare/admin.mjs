const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const css = `
:root{color-scheme:light dark;--canvas:light-dark(#f6f8fa,#0d1117);--paper:light-dark(#fff,#161b22);--ink:light-dark(#1f2328,#f0f6fc);--muted:light-dark(#59636e,#b1bac4);--line:light-dark(#d1d9e0,#3d444d);--accent:light-dark(#0969da,#79c0ff);font:16px/1.55 system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink)}main{width:min(100% - 2rem,42rem);margin:clamp(1.5rem,7vw,4rem) auto}a{color:var(--accent);text-underline-offset:.2em}h1,h2,p{margin:0}h1{font-size:clamp(2rem,6vw,2.8rem);line-height:1.05;letter-spacing:-.055em}h1 span{color:var(--accent)}h2{font-size:1.125rem;line-height:1.3}header p,section p{margin-top:.6rem;color:var(--muted)}section{margin-top:1rem;padding:clamp(1rem,4vw,1.5rem);background:var(--paper);border:1px solid var(--line);border-radius:.7rem}label{display:block;font-weight:600;margin:1rem 0 .4rem}.add{display:flex;flex-wrap:wrap;gap:.55rem}input,button{font:inherit;min-height:2.75rem;border-radius:.35rem;padding:.45rem .7rem}input{flex:1 1 14rem;min-width:0;background:var(--paper);color:var(--ink);border:1px solid var(--line)}button{cursor:pointer;font-weight:600;background:var(--canvas);color:var(--ink);border:1px solid var(--line)}.primary{color:light-dark(#fff,#0d1117);background:var(--accent);border-color:var(--accent)}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}ul{padding:0;list-style:none;margin:.7rem 0 0}li{display:flex;align-items:center;justify-content:space-between;gap:.5rem;border-top:1px solid var(--line);padding:.45rem 0}li a{overflow-wrap:anywhere}code{font-size:.85em}footer{margin-top:1rem;color:var(--muted);font-size:.85rem}.notice{margin:1rem 0 0;padding:.65rem .8rem;border:1px solid var(--line);border-radius:.35rem;background:var(--paper)}
`;

export function adminPage(ids, message = '', status = 200) {
  const rows = ids.map(id => `<li><a href="https://giphy.com/gifs/${esc(id)}" target="_blank" rel="noreferrer"><code>${esc(id)}</code></a><form method="post" action="/admin"><input type="hidden" name="action" value="remove"><input type="hidden" name="gif" value="${esc(id)}"><button aria-label="Quitar GIF ${esc(id)}">Quitar</button></form></li>`).join('');
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catálogo · jatoGifs</title><style>${css}</style></head><body><main>
<header><h1>jato<span>Gifs</span></h1><p>Gestiona los GIF que aparecen al escribir <code>/gif</code> en GitHub.</p></header>
${message ? `<p class="notice" role="status">${esc(message)}</p>` : ''}
<section><h2>Añadir un GIF</h2><p id="help">Pega el enlace de su página en GIPHY o su ID. Aparecerá al volver a abrir el selector si está disponible en GIPHY.</p>
<form method="post" action="/admin"><input type="hidden" name="action" value="add"><label for="gif">Enlace o ID de GIPHY</label><div class="add"><input id="gif" name="gif" type="text" required maxlength="512" autocomplete="off" spellcheck="false" aria-describedby="help"><button class="primary">Añadir GIF</button></div></form></section>
<section><h2>Catálogo · ${ids.length} de 100</h2>${rows ? `<ul>${rows}</ul>` : '<p>Aún no hay GIF en el catálogo.</p>'}</section>
<footer><a href="/cdn-cgi/access/logout">Cerrar sesión</a></footer></main></body></html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
