(() => {
  'use strict';
  const ext = globalThis.browser ?? chrome;
  if (globalThis.__jatoGifsLoaded) return;
  globalThis.__jatoGifsLoaded = true;
  let active = null;
  let statusTimer;
  const core = globalThis.JatoCore;

  function eligible(element) {
    if (!(element instanceof HTMLTextAreaElement) || element.disabled || element.readOnly) return false;
    if (/^\/[^/]+\/[^/]+\/(?:edit|new|blob)\//.test(location.pathname)) return false;
    if (element.closest('.cm-editor, .CodeMirror, [data-code-editor]')) return false;
    const identity = `${element.name} ${element.id} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-testid') || ''}`;
    return /body|comment|discussion|description|markdown/i.test(identity) || !!element.closest('markdown-input, .js-comment-field, [data-testid="markdown-editor"]');
  }

  function announce(text, visible = true) {
    let node = document.getElementById('jatogifs-status');
    if (!node) {
      node = document.createElement('div'); node.id = 'jatogifs-status';
      node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
      document.documentElement.append(node);
    }
    node.removeAttribute('style');
    Object.assign(node.style, visible
      ? { position: 'fixed', bottom: '24px', left: '24px', zIndex: '2147483647', maxWidth: 'min(420px, 90vw)', padding: '12px 16px', borderRadius: '8px', color: '#fff', background: '#24292f', font: '14px/1.5 system-ui' }
      : { position: 'fixed', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' });
    node.textContent = text; clearTimeout(statusTimer);
    statusTimer = setTimeout(() => node.remove(), 6000);
  }

  function close(restoreFocus = false) {
    if (!active) return;
    const old = active; active = null;
    old.frame.remove();
    for (const [name, value] of Object.entries(old.aria)) {
      if (value === null) old.editor.removeAttribute(name); else old.editor.setAttribute(name, value);
    }
    ext.runtime.sendMessage({ type: 'CLOSE', session: old.session }).catch(() => {});
    if (restoreFocus && old.editor.isConnected) {
      old.editor.focus({ preventScroll: true });
      if (old.editor.value === old.snapshot.value) old.editor.setSelectionRange(old.snapshot.end, old.snapshot.end);
    }
  }

  function position() {
    if (!active) return;
    const rect = active.editor.getBoundingClientRect();
    if (!active.editor.isConnected || rect.bottom < 0 || rect.top > innerHeight) { close(); return; }
    // A site may apply CSS zoom to <html>. Keep viewport coordinates in CSS pixels.
    const pageZoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    active.frame.style.zoom = String(1 / pageZoom);
    const width = Math.max(180, Math.min(416, innerWidth - 24));
    const height = Math.max(160, Math.min(456, innerHeight - 24));
    const below = innerHeight - rect.bottom - 12;
    const top = below >= height ? rect.bottom + 6 : Math.max(12, Math.min(rect.top - height - 6, innerHeight - height - 12));
    Object.assign(active.frame.style, { width: `${width}px`, height: `${height}px`, left: `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`, top: `${top}px` });
  }

  function theme() {
    const html = document.documentElement;
    const mode = html.getAttribute('data-color-mode');
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  async function open(editor, command) {
    close();
    const session = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.id = 'jatogifs-picker'; frame.title = 'jatoGifs: GIF de tonela10';
    frame.setAttribute('role', 'dialog'); frame.setAttribute('aria-label', 'Elegir un GIF de tonela10');
    Object.assign(frame.style, { position: 'fixed', zIndex: '2147483646', border: '0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.22)', colorScheme: theme(), background: theme() === 'dark' ? '#161b22' : '#fff' });
    const aria = {};
    for (const name of ['aria-expanded', 'aria-controls']) aria[name] = editor.getAttribute(name);
    editor.setAttribute('aria-expanded', 'true'); editor.setAttribute('aria-controls', frame.id);
    active = { editor, frame, session, snapshot: { value: editor.value, ...command }, aria, href: location.href };
    position();
    try {
      const response = await ext.runtime.sendMessage({ type: 'OPEN', session });
      if (!active || active.session !== session) return;
      if (!response?.ok) throw new Error();
      frame.src = `${ext.runtime.getURL('picker.html')}#${new URLSearchParams({ session, theme: theme() })}`;
      document.documentElement.append(frame);
      announce('jatoGifs abierto. Usa las flechas para elegir y Enter para insertar. Escape para cerrar.', false);
    } catch { if (active?.session === session) { close(); announce('No se pudo abrir jatoGifs. Recarga esta pestaña e inténtalo de nuevo.'); } }
  }

  document.addEventListener('input', event => {
    if (active) {
      if (event.target === active.editor && active.editor.value !== active.snapshot.value) close();
      else return;
    }
    if (!eligible(event.target) || event.isComposing) return;
    const editor = event.target;
    const command = core.findCommand(editor.value, editor.selectionStart, editor.selectionEnd);
    if (command) void open(editor, command);
  }, true);

  document.addEventListener('keydown', event => {
    if (!active || event.target !== active.editor || event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(true); return; }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault(); event.stopImmediatePropagation();
      active.frame.contentWindow?.postMessage({ type: 'JATO_FOCUS', session: active.session }, '*');
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault(); event.stopImmediatePropagation();
      active.frame.contentWindow?.postMessage({ type: 'JATO_KEY', key: event.key, session: active.session }, '*');
    }
  }, true);
  document.addEventListener('pointerdown', event => { if (active && event.target !== active.frame) close(); }, true);
  document.addEventListener('focusin', event => { if (active && event.target !== active.editor && event.target !== active.frame) close(); }, true);
  addEventListener('resize', position);
  addEventListener('scroll', position, true);
  addEventListener('pagehide', () => close());
  document.addEventListener('turbo:before-render', () => close());
  document.addEventListener('pjax:start', () => close());
  const observer = new MutationObserver(() => {
    if (active && (!active.editor.isConnected || active.href !== location.href || active.editor.value !== active.snapshot.value)) close();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  ext.runtime.onMessage.addListener(message => {
    if (!active || message.session !== active.session) return;
    if (message.type === 'DISMISS') { close(true); return; }
    if (message.type !== 'SELECT') return;
    const { editor, snapshot } = active;
    const result = core.replacement(snapshot, editor.value, message.gif);
    if (!editor.isConnected || !result) { close(); announce('El borrador ha cambiado. Vuelve a escribir /gif para elegir de nuevo.'); return; }
    close(); editor.focus({ preventScroll: true }); editor.setSelectionRange(snapshot.start, snapshot.end);
    // Native text insertion preserves the editor undo stack.
    let notified = false;
    const notice = () => { notified = true; };
    editor.addEventListener('input', notice, { once: true });
    const inserted = document.execCommand('insertText', false, result.text);
    editor.removeEventListener('input', notice);
    if (!inserted || editor.value !== result.value) { announce('GitHub no ha permitido insertar el GIF. Tu borrador sigue en el editor.'); return; }
    if (!notified) editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: result.text }));
    editor.setSelectionRange(result.cursor, result.cursor);
    announce('GIF insertado. Puedes previsualizarlo o deshacer la inserción.');
  });
})();
