'use client';

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ZoomIn } from 'lucide-react';
import ImageZoomViewer from '@/components/ImageZoomViewer';
import type { BeforeAfterMode } from '@/content/types';
import ImageAnnotations from '@/components/ImageAnnotations';
import type { WorkImageAnnotation } from '@/content/works/types';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeAnnotations?: readonly WorkImageAnnotation[];
  mode: BeforeAfterMode;
  priority?: boolean;
  showHint?: boolean;
  hintText?: string;
  enableZoom?: boolean;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeAnnotations = [],
  mode,
  priority = false,
  showHint = false,
  hintText = '← 손잡이를 좌우로 움직여 보세요 →',
  enableZoom = false,
}: BeforeAfterSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [position, setPosition] = useState(50);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const loading = priority ? 'eager' : 'lazy';
  const closeZoom = useCallback(() => setZoomOpen(false), []);

  const updateFromPointer = (clientX: number) => {
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition(clamp(((clientX - bounds.left) / bounds.width) * 100));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setHasInteracted(true);
    updateFromPointer(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) updateFromPointer(event.clientX);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    setHasInteracted(true);
    setPosition((current) =>
      clamp(current + (event.key === 'ArrowRight' ? 5 : -5)),
    );
  };

  const slider = mode === 'split'
    ? (
      <div className="before-after-slider before-after-split">
        <div className="before-after-panel">
          <img
            src={beforeSrc}
            alt={beforeAlt}
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
          />
          <ImageAnnotations annotations={beforeAnnotations} />
          <span className="comparison-label comparison-label-before">
            BEFORE
          </span>
        </div>
        <div className="before-after-panel">
          <img
            src={afterSrc}
            alt={afterAlt}
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
          />
          <span className="comparison-label comparison-label-after">AFTER</span>
        </div>
      </div>
    )
    : (
    <div
      ref={sliderRef}
      className="before-after-slider before-after-drag"
      role="slider"
      tabIndex={0}
      aria-label={`${beforeAlt}와 ${afterAlt} 비교`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`애프터 이미지 ${Math.round(100 - position)}% 표시`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
    >
      <img
        className="comparison-image comparison-before-image"
        src={beforeSrc}
        alt={beforeAlt}
        width="1600"
        height="1200"
        loading={loading}
        decoding={priority ? undefined : 'async'}
        fetchPriority={priority ? 'high' : undefined}
      />
      <ImageAnnotations annotations={beforeAnnotations} />
      <div
        className="comparison-after-layer"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <img
          className="comparison-image"
          src={afterSrc}
          alt={afterAlt}
          width="1600"
          height="1200"
          loading={loading}
          decoding={priority ? undefined : 'async'}
          fetchPriority={priority ? 'high' : undefined}
        />
      </div>
      <span className="comparison-label comparison-label-before">BEFORE</span>
      <span className="comparison-label comparison-label-after">AFTER</span>
      <span
        className="comparison-handle"
        style={{ left: `${position}%` }}
        aria-hidden="true"
      >
        <span className="comparison-handle-line" />
        <span className="comparison-handle-knob">↔</span>
      </span>
    </div>
  );

  const sliderWithZoom = enableZoom ? (
    <div className="before-after-zoom-shell">
      {slider}
      <button
        className="before-after-zoom-trigger"
        type="button"
        onClick={() => setZoomOpen(true)}
        aria-label="전후 사진 크게 보기"
        aria-haspopup="dialog"
      >
        <ZoomIn aria-hidden="true" />
        <span>크게 보기</span>
      </button>
      <ImageZoomViewer
        open={zoomOpen}
        beforeSrc={beforeSrc}
        afterSrc={afterSrc}
        beforeAlt={beforeAlt}
        afterAlt={afterAlt}
        beforeAnnotations={beforeAnnotations}
        onClose={closeZoom}
      />
    </div>
  ) : slider;

  if (!showHint) return sliderWithZoom;

  return (
    <div className="before-after-with-hint">
      <span className={`comparison-hint${hasInteracted ? ' is-hidden' : ''}`}>
        {hintText}
      </span>
      {sliderWithZoom}
    </div>
  );
}
