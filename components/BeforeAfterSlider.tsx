'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { BeforeAfterMode } from '@/content/types';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  mode: BeforeAfterMode;
  priority?: boolean;
  showHint?: boolean;
  hintText?: string;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  mode,
  priority = false,
  showHint = false,
  hintText = '← 손잡이를 좌우로 움직여 보세요 →',
}: BeforeAfterSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [position, setPosition] = useState(50);
  const [hasInteracted, setHasInteracted] = useState(false);
  const loading = priority ? 'eager' : 'lazy';

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

  if (mode === 'split') {
    return (
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
    );
  }

  const slider = (
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

  if (!showHint) return slider;

  return (
    <div className="before-after-with-hint">
      <span className={`comparison-hint${hasInteracted ? ' is-hidden' : ''}`}>
        {hintText}
      </span>
      {slider}
    </div>
  );
}
