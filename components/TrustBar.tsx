'use client';

import { useEffect, useRef, useState } from 'react';
import naverData from '@/content/naver.json';
import trustData from '@/content/trust.json';
import type { NaverContent, TrustItem } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const trustItems = trustData as TrustItem[];
const naver = naverData as NaverContent;
const numberFormatter = new Intl.NumberFormat('ko-KR');

function easeOutQuad(progress: number) {
  return progress * (2 - progress);
}

function TrustValue({
  item,
  active,
  delay,
}: {
  item: TrustItem;
  active: boolean;
  delay: number;
}) {
  const target = Number.parseInt(item.value, 10);
  const [currentValue, setCurrentValue] = useState(item.countUp ? 0 : target);

  useEffect(() => {
    if (!item.countUp || !active) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) {
      setCurrentValue(target);
      return;
    }

    let animationFrame = 0;
    let startTimer = 0;
    let startedAt: number | null = null;
    const duration = item.duration ?? 1500;

    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      setCurrentValue(Math.round(target * easeOutQuad(progress)));

      if (progress < 1) animationFrame = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      animationFrame = window.requestAnimationFrame(animate);
    };

    if (delay === 0) startAnimation();
    else startTimer = window.setTimeout(startAnimation, delay);

    return () => {
      window.clearTimeout(startTimer);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [active, delay, item.countUp, item.duration, target]);

  const value = item.countUp
    ? numberFormatter.format(currentValue)
    : item.value;

  return (
    <>
      <strong className="trust-value">
        <span>{value}</span>
        {item.valueSuffix && <small>{item.valueSuffix}</small>}
      </strong>
      <span className="trust-label">
        {item.label}
        {item.linkKey && (
          <span className="trust-external-icon" aria-hidden="true">
            ↗
          </span>
        )}
      </span>
      <span className="trust-sub">{item.sub}</span>
    </>
  );
}

export default function TrustBar() {
  const sectionRef = useRef<HTMLElement>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || hasEntered) return;

    if (!('IntersectionObserver' in window)) {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHasEntered(true);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [hasEntered]);

  return (
    <section
      ref={sectionRef}
      className="trust-strip"
      aria-label="에이스덴트 신뢰 정보"
    >
      {trustItems.map((item, index) => {
        const content = (
          <TrustValue item={item} active={hasEntered} delay={index * 150} />
        );
        const linkUrl = item.linkKey
          ? withLandingUtm(naver[item.linkKey], item.linkKey)
          : null;

        return linkUrl ? (
          <a
            className="trust-item trust-item-link"
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            key={item.id}
          >
            {content}
          </a>
        ) : (
          <div className="trust-item" key={item.id}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
