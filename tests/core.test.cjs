const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/core.js');
const gif = { title: 'Approved [GIF]', url: 'https://media.giphy.com/media/example/giphy.gif?cid=original&rid=giphy.gif&ct=g' };

test('recognizes the exact command at the cursor and preserves its range', () => {
  for (const [value, caret, expected] of [['/gif', 4, 0], ['Antes /gif después', 10, 6], ['Hola\n/gif', 9, 5]]) {
    assert.deepEqual(core.findCommand(value, caret), { start: expected, end: caret });
  }
});
test('does not hijack links, larger words, selected text or code blocks', () => {
  for (const value of ['https://test/gif', 'foo/gif', '/gift', '/gifs', '`/gif', '``text /gif', '    /gif', '\t/gif', '```js\n/gif', '~~~\n/gif', '[gif]( /gif']) {
    const cursor = value.includes('/gift') || value.includes('/gifs') ? 4 : value.length;
    assert.equal(core.findCommand(value, cursor), null, value);
  }
  assert.equal(core.findCommand('/gif', 0, 4), null);
  assert.ok(core.findCommand('```\ncode\n```\n/gif', 17));
});
test('replaces only the captured command at beginning, middle and end', () => {
  for (const value of ['/gif y texto', 'Antes /gif después', 'Antes /gif']) {
    const start = value.indexOf('/gif');
    const result = core.replacement({ value, start, end: start + 4 }, value, gif);
    assert.equal(result.value, value.slice(0, start) + core.markdown(gif) + value.slice(start + 4));
    assert.equal(result.cursor, start + result.text.length);
  }
});
test('refuses to overwrite a changed draft', () => {
  assert.equal(core.replacement({ value: '/gif', start: 0, end: 4 }, '/gif cambiado', gif), null);
  assert.equal(core.replacement({ value: 'text', start: 0, end: 4 }, 'text', gif), null);
});
test('escapes titles and preserves the exact API URL including query parameters', () => {
  assert.equal(core.markdown(gif), `![Approved \\[GIF\\]](<${gif.url}>)`);
  assert.ok(core.markdown({ title: 'one\ntwo', url: gif.url }).startsWith('![one two]'));
  for (const url of ['javascript:alert(1)', 'https://giphy.com.evil.test/a.gif', 'http://media.giphy.com/a.gif', 'https://user@media.giphy.com/a.gif', 'https://media.giphy.com/a.gif>bad', 'https://media.giphy.com/a b.gif']) assert.throws(() => core.markdown({ url }));
});
