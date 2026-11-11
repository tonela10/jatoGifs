(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JatoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function findCommand(value, start, end = start) {
    if (start !== end || start < 4 || value.slice(start - 4, start) !== '/gif') return null;
    const from = start - 4;
    if (from && !/\s/.test(value[from - 1])) return null;
    if (value[start] && !/\s/.test(value[start])) return null;
    // Do not open in fenced or inline code, or in a Markdown link URL.
    let fence = null;
    const before = value.slice(0, from);
    for (const line of before.split('\n')) {
      const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (match && !fence) fence = match[1];
      else if (match && match[1][0] === fence?.[0] && match[1].length >= fence.length) fence = null;
    }
    const line = before.slice(before.lastIndexOf('\n') + 1);
    let inlineTicks = 0;
    for (const run of line.matchAll(/(?<!\\)(`+)/g)) {
      if (!inlineTicks) inlineTicks = run[1].length;
      else if (run[1].length === inlineTicks) inlineTicks = 0;
    }
    if (fence || inlineTicks || /^(?: {4}|\t)/.test(line) || /\]\([^)]*$/.test(line)) return null;
    return { start: from, end: start };
  }

  function safeMediaUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        /(^|\.)giphy\.com$/.test(url.hostname) && url.port === '';
    } catch { return false; }
  }

  function markdown(gif) {
    if (!gif || !safeMediaUrl(gif.url)) throw new Error('URL de GIF no válida.');
    const title = String(gif.title || 'GIF de tonela10').replace(/[\r\n\t]+/g, ' ')
      .slice(0, 180).replace(/[\\\[\]<>]/g, '\\$&');
    // Angle brackets preserve query strings and parentheses without altering the API URL.
    if (/[<>\s]/.test(gif.url)) throw new Error('URL de GIF no válida.');
    return `![${title}](<${gif.url}>)`;
  }

  function replacement(snapshot, current, gif) {
    if (!snapshot || snapshot.value !== current || current.slice(snapshot.start, snapshot.end) !== '/gif') return null;
    const text = markdown(gif);
    return { text, value: current.slice(0, snapshot.start) + text + current.slice(snapshot.end), cursor: snapshot.start + text.length };
  }

  return Object.freeze({ findCommand, safeMediaUrl, markdown, replacement });
});
