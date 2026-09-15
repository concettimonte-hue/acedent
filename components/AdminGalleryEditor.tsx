'use client';

/* oxlint-disable next/no-img-element -- Vite SPA uses pre-compressed static/R2 images. */

import { useState, type DragEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Images,
  Trash2,
} from 'lucide-react';

export interface AdminGalleryItemView {
  id: string;
  preview?: string;
  bytes?: number;
  caption: string;
  processing?: boolean;
}

interface AdminGalleryEditorProps {
  title: string;
  description: string;
  items: readonly AdminGalleryItemView[];
  maxItems: number;
  availableSlots?: number;
  onFiles: (files: File[]) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}

export default function AdminGalleryEditor({
  title,
  description,
  items,
  maxItems,
  availableSlots,
  onFiles,
  onCaptionChange,
  onMove,
  onRemove,
}: AdminGalleryEditorProps) {
  const [dragging, setDragging] = useState(false);
  const remaining = Math.min(
    Math.max(0, maxItems - items.length),
    availableSlots ?? Number.POSITIVE_INFINITY,
  );

  const receiveFiles = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length > 0) onFiles(images.slice(0, remaining));
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    receiveFiles([...event.dataTransfer.files]);
  };

  return (
    <section className="admin-gallery-editor">
      <header>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <span>{items.length}/{maxItems}장</span>
      </header>

      {items.length > 0 && (
        <div className="admin-gallery-items">
          {items.map((item, index) => (
            <article className="admin-gallery-item" key={item.id}>
              <div className="admin-gallery-thumb">
                {item.preview
                  ? <img src={item.preview} alt={`${title} ${index + 1} 미리보기`} width="800" height="600" />
                  : <span>처리 중…</span>}
                <span>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div className="admin-gallery-item-fields">
                <label>
                  사진 설명 <small>선택</small>
                  <input
                    value={item.caption}
                    maxLength={120}
                    onChange={(event) => onCaptionChange(item.id, event.target.value)}
                    placeholder="예: 도장면 정리 후 마감 상태"
                  />
                </label>
                <div className="admin-gallery-item-actions">
                  <button type="button" disabled={index === 0 || item.processing} onClick={() => onMove(item.id, -1)} aria-label={`${index + 1}번 사진 앞으로 이동`}>
                    <ArrowLeft aria-hidden="true" />
                  </button>
                  <button type="button" disabled={index === items.length - 1 || item.processing} onClick={() => onMove(item.id, 1)} aria-label={`${index + 1}번 사진 뒤로 이동`}>
                    <ArrowRight aria-hidden="true" />
                  </button>
                  <button className="is-delete" type="button" disabled={item.processing} onClick={() => onRemove(item.id)}>
                    <Trash2 aria-hidden="true" /> 삭제
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <label
        className={`admin-gallery-dropzone${dragging ? ' is-dragging' : ''}${remaining === 0 ? ' is-disabled' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (remaining > 0) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = remaining > 0 ? 'copy' : 'none';
        }}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={remaining === 0}
          onChange={(event) => {
            receiveFiles([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
        <Images aria-hidden="true" />
        <strong>{remaining > 0 ? '여러 장 선택하거나 여기에 끌어놓기' : '추가 사진 등록 완료'}</strong>
        <span>{remaining > 0 ? `최대 ${remaining}장 더 추가할 수 있습니다.` : '필요하면 기존 사진을 삭제한 뒤 추가하세요.'}</span>
      </label>
    </section>
  );
}
