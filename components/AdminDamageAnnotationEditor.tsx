'use client';

/* oxlint-disable next/no-img-element -- Vite admin uses client-side processed image previews. */

import { useRef, useState, type PointerEvent } from 'react';
import { Circle, MoveUpRight, RotateCcw, Trash2 } from 'lucide-react';
import ImageAnnotations from '@/components/ImageAnnotations';
import type { WorkImageAnnotation } from '@/content/works/types';
import { WORK_IMAGE_ANNOTATION_MAX } from '@/lib/work-annotations';

interface Point {
  x: number;
  y: number;
}

interface AdminDamageAnnotationEditorProps {
  imageSrc: string;
  imageAlt: string;
  annotations: readonly WorkImageAnnotation[];
  onChange: (annotations: WorkImageAnnotation[]) => void;
}

type Tool = WorkImageAnnotation['type'];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function AdminDamageAnnotationEditor({
  imageSrc,
  imageAlt,
  annotations,
  onChange,
}: AdminDamageAnnotationEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<Point | null>(null);
  const [tool, setTool] = useState<Tool>('circle');
  const [draft, setDraft] = useState<WorkImageAnnotation | null>(null);
  const full = annotations.length >= WORK_IMAGE_ANNOTATION_MAX;

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    };
  };

  const makeDraft = (start: Point, end: Point): WorkImageAnnotation => {
    if (tool === 'arrow') {
      return { type: 'arrow', startX: start.x, startY: start.y, endX: end.x, endY: end.y };
    }
    return {
      type: 'circle',
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (full) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    startRef.current = point;
    setDraft(makeDraft(point, point));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    event.preventDefault();
    setDraft(makeDraft(startRef.current, pointFromEvent(event)));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const end = pointFromEvent(event);
    let next = makeDraft(start, end);
    if (next.type === 'circle' && (next.width < 0.03 || next.height < 0.03)) {
      const width = 0.18;
      const height = 0.18;
      next = {
        type: 'circle',
        x: clamp(end.x - width / 2),
        y: clamp(end.y - height / 2),
        width,
        height,
      };
      if (next.x + next.width > 1) next.x = 1 - next.width;
      if (next.y + next.height > 1) next.y = 1 - next.height;
    } else if (next.type === 'arrow' && Math.hypot(next.endX - next.startX, next.endY - next.startY) < 0.03) {
      next = {
        type: 'arrow',
        startX: clamp(end.x - 0.16),
        startY: clamp(end.y - 0.12),
        endX: end.x,
        endY: end.y,
      };
    }
    onChange([...annotations, next]);
    startRef.current = null;
    setDraft(null);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    startRef.current = null;
    setDraft(null);
  };

  return (
    <div className="admin-annotation-editor">
      <div className="admin-annotation-toolbar">
        <fieldset aria-label="손상 위치 표시 도구">
          <button type="button" className={tool === 'circle' ? 'is-active' : ''} aria-pressed={tool === 'circle'} onClick={() => setTool('circle')}>
            <Circle aria-hidden="true" /> 원
          </button>
          <button type="button" className={tool === 'arrow' ? 'is-active' : ''} aria-pressed={tool === 'arrow'} onClick={() => setTool('arrow')}>
            <MoveUpRight aria-hidden="true" /> 화살표
          </button>
        </fieldset>
        <div>
          <button type="button" disabled={annotations.length === 0} onClick={() => onChange(annotations.slice(0, -1))}>
            <RotateCcw aria-hidden="true" /> 실행 취소
          </button>
          <button type="button" disabled={annotations.length === 0} onClick={() => onChange([])}>
            <Trash2 aria-hidden="true" /> 모두 지우기
          </button>
        </div>
      </div>
      <div
        ref={stageRef}
        className={`admin-annotation-stage${full ? ' is-full' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        aria-label="작업 전 사진 손상 위치 표시 영역"
      >
        <img src={imageSrc} alt={imageAlt} width="1600" height="1200" draggable="false" />
        <ImageAnnotations annotations={draft ? [...annotations, draft] : annotations} />
      </div>
      <div className="admin-annotation-footer">
        <p>{full ? '표시 3개를 모두 사용했습니다. 필요하면 지우고 다시 그려주세요.' : `${tool === 'circle' ? '손상 부위를 감싸듯 드래그하거나 한 번 누르세요.' : '화살표 시작점에서 손상 부위까지 드래그하세요.'}`}</p>
        <strong>{annotations.length} / {WORK_IMAGE_ANNOTATION_MAX}</strong>
      </div>
      {annotations.length > 0 && (
        <div className="admin-annotation-list" aria-label="등록된 손상 위치 표시">
          {annotations.map((annotation, index) => (
            <button type="button" onClick={() => onChange(annotations.filter((_, itemIndex) => itemIndex !== index))} key={`${annotation.type}-${index}`}>
              {index + 1}. {annotation.type === 'circle' ? '원' : '화살표'} 삭제
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
