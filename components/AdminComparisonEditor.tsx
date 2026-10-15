'use client';

/* oxlint-disable next/no-img-element -- locally processed preview images. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- Native file inputs provide keyboard access; labels add optional drag-and-drop only. */
import { useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { WORK_COMPARISON_MAX_PER_PART, WORK_COMPARISON_MAX_TOTAL } from '@/content/works/types';
import type { WorkImageAnnotation } from '@/content/works/types';
import AdminDamageAnnotationEditor from '@/components/AdminDamageAnnotationEditor';
import ImageAnnotations from '@/components/ImageAnnotations';

export interface ComparisonItemView {
  id: string;
  caption: string;
  beforeAnnotations: WorkImageAnnotation[];
  before?: { preview: string; bytes: number };
  after?: { preview: string; bytes: number };
  processing?: 'before' | 'after';
}

interface Props {
  items: ComparisonItemView[];
  availableSlots: number;
  disabled?: boolean;
  onAdd: () => void;
  onFile: (id: string, kind: 'before' | 'after', file: File) => void;
  onCaption: (id: string, value: string) => void;
  onAnnotations: (id: string, annotations: WorkImageAnnotation[]) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onError: (message: string) => void;
}

export default function AdminComparisonEditor(props: Props) {
  const [dragTarget, setDragTarget] = useState('');
  const [annotationEditorId, setAnnotationEditorId] = useState('');
  const select = (id: string, kind: 'before' | 'after', files: File[]) => {
    if (files.length !== 1 || !files[0].type.startsWith('image/')) {
      props.onError('추가 비교의 BEFORE와 AFTER에는 이미지 한 장씩 선택하세요.');
      return;
    }
    props.onFile(id, kind, files[0]);
  };
  const drag = (event: DragEvent<HTMLLabelElement>, target: string, busy: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
    if (!busy) setDragTarget(target);
  };
  return <section className="admin-comparison-editor" aria-label="PART 추가 전후 비교">
    <header><h3>추가 전후 비교 <small>선택</small></h3>
      <p>같은 PART의 다른 각도를 전후 사진으로 보여줍니다. 필터·대표사진에는 반영되지 않습니다.</p>
    </header>
    {props.items.map((item, index) => <fieldset className="admin-comparison-item" key={item.id}>
      <legend>추가 비교 {index + 1}</legend>
      <div className="admin-comparison-actions">
        <button type="button" disabled={props.disabled || index === 0 || Boolean(item.processing)} onClick={() => props.onMove(item.id, -1)} aria-label={`추가 비교 ${index + 1} 위로`}><ArrowUp aria-hidden="true" /></button>
        <button type="button" disabled={props.disabled || index === props.items.length - 1 || Boolean(item.processing)} onClick={() => props.onMove(item.id, 1)} aria-label={`추가 비교 ${index + 1} 아래로`}><ArrowDown aria-hidden="true" /></button>
        <button type="button" disabled={props.disabled || Boolean(item.processing)} onClick={() => props.onRemove(item.id)} aria-label={`추가 비교 ${index + 1} 삭제`}><Trash2 aria-hidden="true" /> 비교 삭제</button>
      </div>
      <label>사진 설명 <small>선택 · 제목으로 표시</small><input disabled={props.disabled} maxLength={120} value={item.caption} onChange={(e) => props.onCaption(item.id, e.target.value)} placeholder="예: 측면에서 본 수리 전후" /></label>
      <div className="admin-image-pair">
        {(['before', 'after'] as const).map((kind) => {
          const selected = item[kind];
          const target = `${item.id}:${kind}`;
          const busy = Boolean(props.disabled || item.processing);
          return <label className={`admin-image-input${selected ? ' has-image' : ''}${dragTarget === target ? ' is-dragging' : ''}`} key={kind}
            onDragEnter={(e) => drag(e, target, busy)} onDragOver={(e) => drag(e, target, busy)}
            onDragLeave={(e) => { if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDragTarget(''); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(''); if (!busy) select(item.id, kind, [...e.dataTransfer.files]); }}>
            <input type="file" accept="image/*" disabled={busy} aria-label={`추가 비교 ${index + 1} ${kind === 'before' ? 'BEFORE' : 'AFTER'} 사진`} onChange={(e) => {
              if (e.currentTarget.files?.length) select(item.id, kind, [...e.currentTarget.files]);
              e.currentTarget.value = '';
            }} />
            {selected ? <img src={selected.preview} alt={`추가 비교 ${index + 1} ${kind === 'before' ? '작업 전' : '작업 후'} 미리보기`} width="1600" height="1200" /> : <ImagePlus aria-hidden="true" />}
            {kind === 'before' && selected && <ImageAnnotations annotations={item.beforeAnnotations} />}
            <strong>{kind === 'before' ? 'BEFORE' : 'AFTER'}</strong>
            <span>{item.processing === kind ? '사진 처리 중…' : selected ? `${Math.ceil(selected.bytes / 1024)}KB · 다시 선택 또는 끌어놓기` : '사진 선택 / PC는 끌어놓기'}</span>
          </label>;
        })}
      </div>
      {item.before && <div className="admin-annotation-block">
        <button type="button" className="admin-annotation-toggle"
          disabled={props.disabled || Boolean(item.processing)}
          aria-label={`추가 비교 ${index + 1} 손상 위치 표시`}
          aria-expanded={annotationEditorId === item.id}
          onClick={() => setAnnotationEditorId((current) => current === item.id ? '' : item.id)}>
          <span>손상 위치 표시 <small>선택 · BEFORE</small></span>
          <strong>{item.beforeAnnotations.length ? `${item.beforeAnnotations.length}개 표시됨` : '원·화살표 추가'}</strong>
        </button>
        {annotationEditorId === item.id && !props.disabled && !item.processing && <AdminDamageAnnotationEditor
          key={`${item.id}:${item.before.preview}`}
          imageSrc={item.before.preview}
          imageAlt={`추가 비교 ${index + 1} 작업 전 손상 표시 편집`}
          annotations={item.beforeAnnotations}
          onChange={(annotations) => props.onAnnotations(item.id, annotations)}
        />}
      </div>}
    </fieldset>)}
    <button type="button" className="admin-add-part" disabled={props.disabled || props.items.length >= WORK_COMPARISON_MAX_PER_PART || props.availableSlots <= 0} onClick={props.onAdd}><Plus aria-hidden="true" /> 전후 비교 추가</button>
    <p className="admin-gallery-limit">PART당 {WORK_COMPARISON_MAX_PER_PART}쌍 · 사례 전체 {WORK_COMPARISON_MAX_TOTAL}쌍까지. 추가한 비교는 전·후 사진을 모두 넣거나 삭제해 주세요.</p>
  </section>;
}
