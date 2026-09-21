'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import ImageAnnotations from '@/components/ImageAnnotations';
import type { WorkImageAnnotation } from '@/content/works/types';

interface ImageZoomViewerProps {
  open: boolean;
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeAnnotations?: readonly WorkImageAnnotation[];
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export default function ImageZoomViewer({
  open,
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeAnnotations = [],
  onClose,
}: ImageZoomViewerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<{
    pointerId: number;
    start: Point;
    origin: Point;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const [activeImage, setActiveImage] = useState<'before' | 'after'>('after');
  const [scale, setScale] = useState(MIN_SCALE);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const clampPan = useCallback((point: Point, nextScale: number) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds || nextScale <= MIN_SCALE) return { x: 0, y: 0 };
    const maxX = (bounds.width * (nextScale - 1)) / 2;
    const maxY = (bounds.height * (nextScale - 1)) / 2;
    return {
      x: clamp(point.x, -maxX, maxX),
      y: clamp(point.y, -maxY, maxY),
    };
  }, []);

  const resetView = useCallback(() => {
    pointersRef.current.clear();
    dragRef.current = null;
    pinchRef.current = null;
    setScale(MIN_SCALE);
    setPan({ x: 0, y: 0 });
  }, []);

  const selectImage = (next: 'before' | 'after') => {
    setActiveImage(next);
    resetView();
  };

  const zoomBy = useCallback((amount: number) => {
    setScale((current) => {
      const next = clamp(current + amount, MIN_SCALE, MAX_SCALE);
      setPan((currentPan) => clampPan(currentPan, next));
      return next;
    });
  }, [clampPan]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setActiveImage('after');
    resetView();
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectImage('before');
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectImage('after');
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [onClose, open, resetView]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = [...pointersRef.current.values()];
    if (pointers.length >= 2) {
      pinchRef.current = {
        distance: Math.max(1, distance(pointers[0], pointers[1])),
        scale,
      };
      dragRef.current = null;
    } else if (scale > MIN_SCALE) {
      dragRef.current = {
        pointerId: event.pointerId,
        start: pointers[0],
        origin: pan,
      };
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const pointers = [...pointersRef.current.values()];

    if (pointers.length >= 2 && pinchRef.current) {
      const next = clamp(
        pinchRef.current.scale *
          (distance(pointers[0], pointers[1]) / pinchRef.current.distance),
        MIN_SCALE,
        MAX_SCALE,
      );
      setScale(next);
      setPan((current) => clampPan(current, next));
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || scale <= MIN_SCALE) return;
    setPan(clampPan({
      x: drag.origin.x + event.clientX - drag.start.x,
      y: drag.origin.y + event.clientY - drag.start.y,
    }, scale));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    const remaining = [...pointersRef.current.entries()][0];
    dragRef.current = remaining && scale > MIN_SCALE
      ? { pointerId: remaining[0], start: remaining[1], origin: pan }
      : null;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 0.25 : -0.25);
  };

  const handleDoubleClick = () => {
    if (scale > MIN_SCALE) resetView();
    else zoomBy(1);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(0.5);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomBy(-0.5);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    }
  };

  if (!open) return null;

  const src = activeImage === 'before' ? beforeSrc : afterSrc;
  const alt = activeImage === 'before' ? beforeAlt : afterAlt;

  return createPortal(
    <div
      className="image-zoom-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="image-zoom-dialog"
        data-image-zoom-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="image-zoom-header">
          <div>
            <p id={titleId}>사진 크게 보기</p>
            <div className="image-zoom-tabs" aria-label="전후 사진 선택">
              <button
                type="button"
                className={activeImage === 'before' ? 'is-active' : ''}
                aria-pressed={activeImage === 'before'}
                onClick={() => selectImage('before')}
              >
                BEFORE
              </button>
              <button
                type="button"
                className={activeImage === 'after' ? 'is-active' : ''}
                aria-pressed={activeImage === 'after'}
                onClick={() => selectImage('after')}
              >
                AFTER
              </button>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="image-zoom-close"
            type="button"
            onClick={onClose}
            aria-label="확대 사진 닫기"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div
          ref={stageRef}
          className={`image-zoom-stage${scale > MIN_SCALE ? ' is-zoomed' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={src}
            alt={alt}
            width="1600"
            height="1200"
            loading="eager"
            draggable="false"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            }}
          />
          {activeImage === 'before' && (
            <ImageAnnotations
              annotations={beforeAnnotations}
              fit="contain"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              }}
            />
          )}
        </div>

        <footer className="image-zoom-toolbar">
          <p>두 손가락 또는 마우스 휠로 확대 · 확대 후 드래그</p>
          <div className="image-zoom-controls" aria-label="사진 확대 조절">
            <button
              type="button"
              onClick={() => zoomBy(-0.5)}
              disabled={scale <= MIN_SCALE}
              aria-label="축소"
            >
              <Minus aria-hidden="true" />
            </button>
            <output aria-live="polite">{Math.round(scale * 100)}%</output>
            <button
              type="button"
              onClick={() => zoomBy(0.5)}
              disabled={scale >= MAX_SCALE}
              aria-label="확대"
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={resetView}
              disabled={scale === MIN_SCALE && pan.x === 0 && pan.y === 0}
              aria-label="확대 초기화"
            >
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
