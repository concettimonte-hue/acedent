'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { EditorContent, useEditor } from '@tiptap/react';
import { Slice } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import WorkDescription from '@/components/WorkDescription';
import { editorDocToWorkBody, workBodyToEditorDoc, plainTextToEditorDoc, workBodyText, workBodyError, WORK_BODY_MAX_LENGTH } from '@/lib/work-body';

interface Props {
  value: string;
  summary: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Admin-only (AdminPage is route-lazy-loaded). No HTML from the editor is stored or rendered. */
export default function AdminBodyEditor({ value, summary, onChange, disabled = false }: Props) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const lastValue = useRef(value);
  const composingChange = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const publish = useRef<() => void>(() => {});
  const expandButton = useRef<HTMLButtonElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({
      heading: { levels: [3] },
      blockquote: false, code: false, codeBlock: false, horizontalRule: false,
      italic: false, strike: false, underline: false, link: false, orderedList: false,
      trailingNode: false,
    })],
    enableInputRules: false,
    enablePasteRules: false,
    content: workBodyToEditorDoc(value),
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': '상세 설명 본문', 'aria-multiline': 'true', 'aria-describedby': `${id}-help`, spellcheck: 'false' },
      handlePaste(view, event) {
        event.preventDefault();
        // Pasted HTML/styles/links/images never enter the document schema.
        const text = event.clipboardData?.getData('text/plain').replace(/\r\n?/g, '\n') ?? '';
        if (text) {
          const doc = view.state.schema.nodeFromJSON(plainTextToEditorDoc(text));
          view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView());
        }
        return true;
      },
      handleDrop: () => true,
      handleDOMEvents: {
        compositionend() { setTimeout(() => publish.current(), 0); return false; },
      },
    },
    onUpdate({ editor: current }) {
      // Do not replace DOM or parent form state during Korean IME composition.
      if (current.view.composing) { composingChange.current = true; return; }
      composingChange.current = false;
      const next = editorDocToWorkBody(current.getJSON());
      lastValue.current = next;
      onChangeRef.current(next);
    },
  });
  publish.current = () => {
    if (!editor || editor.isDestroyed || !composingChange.current) return;
    composingChange.current = false;
    const next = editorDocToWorkBody(editor.getJSON());
    if (next === lastValue.current) return;
    lastValue.current = next;
    onChangeRef.current(next);
  };
  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    composingChange.current = false;
    lastValue.current = value;
    editor.commands.setContent(workBodyToEditorDoc(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);

  const error = workBodyError(value);
  const run = (action: 'heading' | 'bold' | 'list' | 'undo' | 'redo') => {
    if (!editor || disabled) return;
    const chain = editor.chain().focus();
    if (action === 'heading') chain.toggleHeading({ level: 3 }).run();
    else if (action === 'bold') chain.toggleBold().run();
    else if (action === 'list') chain.toggleBulletList().run();
    else if (action === 'undo') chain.undo().run();
    else chain.redo().run();
  };
  const surface = (
    <div className="admin-body-surface">
      <div className="admin-body-modes" role="group" aria-label="본문 보기 방식">
        <button type="button" aria-pressed={mode === 'write'} onClick={() => setMode('write')}>작성</button>
        <button type="button" aria-pressed={mode === 'preview'} onClick={() => { publish.current(); setMode('preview'); }}>미리보기</button>
      </div>
      <div hidden={mode !== 'write'} className="admin-body-writing">
        <div className="admin-body-toolbar" role="group" aria-label="본문 서식">
          <button type="button" disabled={!editor || disabled} aria-pressed={editor?.isActive('heading', { level: 3 }) ?? false} onMouseDown={(e) => e.preventDefault()} onClick={() => run('heading')}>소제목</button>
          <button type="button" disabled={!editor || disabled} aria-pressed={editor?.isActive('bold') ?? false} onMouseDown={(e) => e.preventDefault()} onClick={() => run('bold')}><strong>굵게</strong></button>
          <button type="button" disabled={!editor || disabled} aria-pressed={editor?.isActive('bulletList') ?? false} onMouseDown={(e) => e.preventDefault()} onClick={() => run('list')}>• 목록</button>
          <button type="button" disabled={!editor || disabled || !editor.can().undo()} onMouseDown={(e) => e.preventDefault()} onClick={() => run('undo')}>되돌리기</button>
          <button type="button" disabled={!editor || disabled || !editor.can().redo()} onMouseDown={(e) => e.preventDefault()} onClick={() => run('redo')}>다시 실행</button>
        </div>
        {editor ? <EditorContent editor={editor} className="admin-body-input" /> : <p className="admin-body-loading">편집기를 준비하고 있습니다.</p>}
      </div>
      <div hidden={mode !== 'preview'} className="admin-body-preview">
        <WorkDescription summary={summary} body={value} />
        {!workBodyText(value).trim() && <p className="admin-body-empty">작성한 본문이 여기에 표시됩니다.</p>}
      </div>
      <p className="admin-body-help" id={`${id}-help`}>확인한 손상과 실제 작업을 적어 주세요. 붙여넣기는 글자와 줄바꿈만 가져옵니다.</p>
      <p className={`admin-body-count${error ? ' has-error' : ''}`} role={error ? 'alert' : undefined}>
        {error || `본문 ${workBodyText(value).length.toLocaleString()}자 · 서식 포함 ${value.length.toLocaleString()} / ${WORK_BODY_MAX_LENGTH.toLocaleString()}자`}
      </p>
    </div>
  );
  return (
    <div className="admin-body-editor">
      <div className="admin-body-heading"><span>상세 설명</span><button type="button" ref={expandButton} disabled={disabled || !editor} onClick={() => setExpanded(true)}>크게 쓰기 ↗</button></div>
      {!expanded && surface}
      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Backdrop className="admin-body-backdrop" />
          <Dialog.Popup className="admin-body-dialog" finalFocus={expandButton}>
            <header><Dialog.Title>상세 설명 크게 쓰기</Dialog.Title><Dialog.Close className="admin-body-close">편집 완료</Dialog.Close></header>
            <Dialog.Description className="sr-only">입력 내용은 원래 폼에 유지됩니다. 실제 저장은 사례 저장 버튼으로 진행하세요.</Dialog.Description>
            {expanded && surface}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
