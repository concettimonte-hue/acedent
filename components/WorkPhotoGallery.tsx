'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import type {
  WorkGalleryImage,
  WorkItem,
  WorkPartMedia,
} from '@/content/works/types';
import {
  getWorkGalleryImageAlt,
  resolveWorkImageSrc,
} from '@/lib/work-images';

interface WorkPhotoGalleryProps {
  images: readonly WorkGalleryImage[];
  work: WorkItem;
  part?: WorkPartMedia;
  label?: string;
  title?: string;
  compact?: boolean;
}

interface GalleryViewerProps {
  images: readonly WorkGalleryImage[];
  work: WorkItem;
  part?: WorkPartMedia;
  initialIndex: number;
  onClose: () => void;
}

function GalleryViewer({
  images,
  work,
  part,
  initialIndex,
  onClose,
}: GalleryViewerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const active = images[activeIndex];

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + images.length) % images.length);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % images.length);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
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
  }, [images.length, onClose]);

  return createPortal(
    <div
      className="work-gallery-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="work-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <div>
            <p id={titleId}>추가 사진</p>
            <span>{activeIndex + 1} / {images.length}</span>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="추가 사진 닫기">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="work-gallery-stage">
          <img
            src={resolveWorkImageSrc(active.src)}
            alt={getWorkGalleryImageAlt(work, active, activeIndex, part)}
            width={active.width}
            height={active.height}
            loading="eager"
          />
          {images.length > 1 && (
            <>
              <button
                className="work-gallery-previous"
                type="button"
                onClick={() => setActiveIndex((current) => (current - 1 + images.length) % images.length)}
                aria-label="이전 사진"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="work-gallery-next"
                type="button"
                onClick={() => setActiveIndex((current) => (current + 1) % images.length)}
                aria-label="다음 사진"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {active.caption && <p className="work-gallery-viewer-caption">{active.caption}</p>}
      </div>
    </div>,
    document.body,
  );
}

export default function WorkPhotoGallery({
  images,
  work,
  part,
  label = 'DETAIL PHOTOS',
  title = '사진 더 보기',
  compact = false,
}: WorkPhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);
  if (images.length === 0) return null;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('.work-photo-gallery-item'),
    );
    const firstOffset = items[0]?.offsetLeft ?? 0;
    const currentLeft = event.currentTarget.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item, index) => {
      const distance = Math.abs(item.offsetLeft - firstOffset - currentLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setVisibleIndex(closestIndex);
  };

  return (
    <section className={`work-photo-gallery${compact ? ' is-compact' : ''}`}>
      <header>
        <p>{label}</p>
        <h3>{title}</h3>
        <span>사진을 누르면 크게 볼 수 있습니다.</span>
      </header>
      <div
        className="work-photo-gallery-grid"
        data-count={Math.min(images.length, 4)}
        onScroll={handleScroll}
      >
        {images.map((image, index) => (
          <button
            type="button"
            className="work-photo-gallery-item"
            onClick={() => setActiveIndex(index)}
            aria-label={`${getWorkGalleryImageAlt(work, image, index, part)} 크게 보기`}
            key={`${image.src}-${index}`}
          >
            <img
              src={resolveWorkImageSrc(image.thumbnail || image.src)}
              alt={getWorkGalleryImageAlt(work, image, index, part)}
              width="800"
              height="600"
              loading="lazy"
              decoding="async"
            />
            <span className="work-photo-gallery-expand"><Expand aria-hidden="true" /></span>
            {image.caption && <span className="work-photo-gallery-caption">{image.caption}</span>}
            {index === 3 && images.length > 4 && (
              <span className="work-photo-gallery-more">+{images.length - 4}장</span>
            )}
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div className="work-photo-gallery-swipe-guide" aria-hidden="true">
          <span>옆으로 넘겨보세요</span>
          <div className="work-photo-gallery-dots">
            {images.map((image, index) => (
              <i
                className={index === visibleIndex ? 'is-active' : undefined}
                key={`${image.src}-dot-${index}`}
              />
            ))}
          </div>
          <strong>{visibleIndex + 1} / {images.length}</strong>
        </div>
      )}
      {activeIndex !== null && (
        <GalleryViewer
          images={images}
          work={work}
          part={part}
          initialIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </section>
  );
}
