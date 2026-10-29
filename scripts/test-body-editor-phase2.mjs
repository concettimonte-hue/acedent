import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { loadTs } from './test-support.mjs';

const { adminFormSnapshot } = loadTs('hooks/use-admin-unsaved-changes.ts');
const body = loadTs('lib/work-body.ts');
const text = (value, bold = false) => ({ type: 'text', text: value, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });
const paragraph = value => ({ type: 'paragraph', content: [text(value, true)] });
const list = values => ({ type: 'bulletList', content: values.map(value => ({ type: 'listItem', content: [paragraph(value)] })) });
function editor(t, content) {
  const e = new Editor({ element: null, extensions: [StarterKit.configure({ trailingNode: false })], content: { type: 'doc', content } });
  t.after(() => e.destroy());
  return e;
}
function select(e, value, start = 0, end = value.length) {
  let position;
  e.state.doc.descendants((node, pos) => { if (node.isText && node.text === value) position = pos; });
  assert.notEqual(position, undefined);
  e.commands.setTextSelection({ from: position + start, to: position + end });
}

test('clear selected bold text leaves adjacent bold and unselected heading unchanged', t => {
  const e = editor(t, [{ type: 'heading', attrs: { level: 3 }, content: [text('남겨둘 소제목')] }, paragraph('앞 선택 뒤')]);
  select(e, '앞 선택 뒤', 2, 4);
  e.chain().unsetAllMarks().clearNodes().run();
  const doc = e.getJSON();
  assert.equal(doc.content[0].type, 'heading');
  assert.deepEqual(doc.content[1].content, [text('앞 ', true), text('선택'), text(' 뒤', true)]);
});
test('clear middle list item splits the list without changing surrounding items', t => {
  const e = editor(t, [list(['첫 항목', '두 번째 항목', '마지막 항목'])]);
  select(e, '두 번째 항목');
  e.chain().unsetAllMarks().clearNodes().run();
  assert.deepEqual(e.getJSON().content, [list(['첫 항목']), { type: 'paragraph', content: [text('두 번째 항목')] }, list(['마지막 항목'])]);
});
test('clear heading/list selection preserves Korean text and safe body round trip', t => {
  const e = editor(t, [{ type: 'heading', attrs: { level: 3 }, content: [text('손상 확인', true)] }, list(['수리 과정', '작업 결과'])]);
  const original = e.state.doc.textContent;
  e.commands.selectAll(); e.chain().unsetAllMarks().clearNodes().run();
  assert.equal(e.state.doc.textContent, original);
  assert(e.getJSON().content.every(node => node.type === 'paragraph'));
  assert(!JSON.stringify(e.getJSON()).includes('marks'));
  const saved = body.editorDocToWorkBody(e.getJSON());
  assert.equal(body.editorDocToWorkBody(body.workBodyToEditorDoc(saved)), saved);
});
test('dirty snapshot ignores ephemeral IDs/processing but detects photo replacement and annotations', () => {
  const initial = { body: '원문', parts: [{ id: 'old', before: { preview: 'blob:photo-a', bytes: 10 }, beforeAnnotations: [] }] };
  const same = { ...initial, parts: [{ ...initial.parts[0], id: 'new', processing: 'before' }] };
  assert.equal(adminFormSnapshot(initial), adminFormSnapshot(same));
  assert.notEqual(adminFormSnapshot(initial), adminFormSnapshot({ ...initial, parts: [{ ...initial.parts[0], before: { preview: 'blob:photo-b', bytes: 10 } }] }));
  assert.notEqual(adminFormSnapshot(initial), adminFormSnapshot({ ...initial, parts: [{ ...initial.parts[0], beforeAnnotations: [{ type: 'circle', x: .5, y: .3 }] }] }));
  assert.notEqual(adminFormSnapshot(initial), adminFormSnapshot({ ...initial, body: '바뀐 원문' }));
});
