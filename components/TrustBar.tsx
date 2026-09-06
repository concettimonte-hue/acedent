'use client';

import { useEffect, useRef, useState } from 'react';
import trustData from '@/content/trust.json';
import type { TrustItem } from '@/content/types';

const trustItems = trustData as TrustItem[];
const numberFormatter = new Intl.NumberFormat('ko-KR');

function easeOutQuad(progress: number) {
  return progress * (2 - progress);
}

function TrustValue({ item, active }: { item: TrustItem; active: boolean }) {
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
    let startedAt: number | null = null;
    const duration = item.duration ?? 1500;

    const animate = (timestamp: number) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      setCurrentValue(Math.round(target * easeOutQuad(progress)));

      if (progress < 1) animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [active, item.countUp, item.duration, target]);

  const value = item.countUp ? numberFormatter.format(currentValue) : item.value;

  return (
    <>
      <strong className="trust-value">
        <span>{value}</span>
        {item.valueSuffix && <small>{item.valueSuffix}</small>}
      </strong>
      <span className="trust-label">{item.label}</span>
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
    <section ref={sectionRef} className="trust-strip" aria-label="에이스덴트 신뢰 정보">
      {trustItems.map((item) => {
        const content = <TrustValue item={item} active={hasEntered} />;

        return item.linkUrl ? (
          <a
            className="trust-item trust-item-link"
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            key={item.id}
          >
            {content}
          </a>
        ) : (
          <div className="trust-item" key={item.id}>{content}</div>
        );
      })}
    </section>
  );
}
