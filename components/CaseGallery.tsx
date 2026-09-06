'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import casesData from '@/content/cases.json';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type { CaseItem, CasesContent, SiteContent } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const content = casesData as CasesContent;
const site = siteData as SiteContent;
const cases = [...content.items].sort((a, b) => a.order - b.order);

const imageAlt = (item: CaseItem, state: '전' | '후') =>
  `${item.car} ${item.part.replaceAll(' · ', ' ')} ${state}`;

export default function CaseGallery() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const returnFocusIndex = useRef<number | null>(null);

  const closeModal = useCallback(() => {
    const index = returnFocusIndex.current;
    setSelectedIndex(null);
    window.requestAnimationFrame(() => {
      if (index !== null) cardRefs.current[index]?.focus();
    });
  }, []);

  const changeCase = useCallback((direction: -1 | 1) => {
    setSelectedIndex((current) => {
      if (current === null) return current;
      return (current + direction + cases.length) % cases.length;
    });
  }, []);

  useEffect(() => {
    if (selectedIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleModalKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.getAttribute('role') !== 'slider' &&
        event.key === 'ArrowLeft'
      ) {
        event.preventDefault();
        changeCase(-1);
        return;
      }
      if (
        target?.getAttribute('role') !== 'slider' &&
        event.key === 'ArrowRight'
      ) {
        event.preventDefault();
        changeCase(1);
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener('keydown', handleModalKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleModalKeys);
    };
  }, [changeCase, closeModal, selectedIndex]);

  const openCase = (index: number) => {
    returnFocusIndex.current = index;
    setSelectedIndex(index);
  };

  const updateActiveIndicator = () => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    const center = gallery.scrollLeft + gallery.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const cardCenter =
        card.offsetLeft - gallery.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  const scrollToCase = (index: number) => {
    const gallery = galleryRef.current;
    const card = cardRefs.current[index];
    if (!gallery || !card) return;
    gallery.scrollTo({
      left: card.offsetLeft - gallery.offsetLeft,
      behavior: 'smooth',
    });
  };

  const selectedCase = selectedIndex === null ? null : cases[selectedIndex];

  return (
    <section id="cases" className="section section-cases">
      <div className="cases-heading">
        <div>
          <p className="section-kicker light">{content.sectionLabel}</p>
          <h2>
            {content.headingLines[0]}
            <br />
            <span>{content.headingLines[1]}</span>
          </h2>
          <p className="cases-guide">{content.instruction}</p>
        </div>
      </div>

      <div
        ref={galleryRef}
        className="case-gallery-grid"
        onScroll={updateActiveIndicator}
      >
        {cases.map((item, index) => (
          <button
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className="case-card"
            type="button"
            key={item.id}
            onClick={() => openCase(index)}
            aria-haspopup="dialog"
            aria-label={`${item.car} ${item.title} 전후 비교 보기`}
          >
            <span className="case-thumbnail">
              <img
                src={item.afterImg}
                alt={imageAlt(item, '후')}
                width="1600"
                height="1200"
                loading="lazy"
                decoding="async"
              />
              <span className="case-number">
                CASE {String(index + 1).padStart(2, '0')}
              </span>
              <span className="case-compare-icon" aria-hidden="true">
                ↔
              </span>
            </span>
            <span className="case-card-copy">
              <span className="case-card-meta">
                <span>{item.car}</span>
                <strong>{item.days}</strong>
              </span>
              <span className="case-card-title">{item.title}</span>
              <span className="case-card-part">{item.part}</span>
              <span className="case-card-action">비교 보기 →</span>
            </span>
          </button>
        ))}
      </div>

      <div className="case-indicators" aria-label="작업사례 위치">
        {cases.map((item, index) => (
          <button
            type="button"
            className={activeIndex === index ? 'is-active' : ''}
            aria-label={`${index + 1}번 사례로 이동`}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => scrollToCase(index)}
            key={item.id}
          />
        ))}
      </div>

      <div className="cases-bottom-link-wrap">
        <a
          className="cases-bottom-link"
          href={withLandingUtm(naverData.blog, 'cases_bottom')}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content.bottomLinkLabel}
        </a>
      </div>

      {selectedCase && (
        <div
          className="case-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            className="case-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-modal-title"
          >
            <button
              ref={closeButtonRef}
              className="case-modal-close"
              type="button"
              onClick={closeModal}
              aria-label="모달 닫기"
            >
              <X aria-hidden="true" />
            </button>
            <div className="case-modal-media">
              <BeforeAfterSlider
                beforeSrc={selectedCase.beforeImg}
                afterSrc={selectedCase.afterImg}
                beforeAlt={imageAlt(selectedCase, '전')}
                afterAlt={imageAlt(selectedCase, '후')}
                mode={selectedCase.sliderType}
              />
              <button
                className="case-modal-nav case-modal-prev"
                type="button"
                onClick={() => changeCase(-1)}
                aria-label="이전 작업사례"
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <button
                className="case-modal-nav case-modal-next"
                type="button"
                onClick={() => changeCase(1)}
                aria-label="다음 작업사례"
              >
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
            <div className="case-modal-copy">
              <p className="case-modal-count">
                CASE {String(selectedIndex! + 1).padStart(2, '0')} /{' '}
                {String(cases.length).padStart(2, '0')}
              </p>
              <h3 id="case-modal-title">{selectedCase.title}</h3>
              <div className="case-modal-details">
                <span>{selectedCase.car}</span>
                <span>{selectedCase.part}</span>
                <strong>{selectedCase.days}</strong>
              </div>
              <p>{selectedCase.summary}</p>
              <div className="case-modal-actions">
                <a className="case-modal-phone" href={site.contact.phoneHref}>
                  이런 손상이면 문의하기
                </a>
                <a
                  className="case-modal-blog"
                  href={withLandingUtm(selectedCase.blogUrl, 'case')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content.modalLinkLabel} <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
