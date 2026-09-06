'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import SectionNumber from '@/components/SectionNumber';
import processData from '@/content/process.json';
import type { ProcessContent } from '@/content/types';

const content = processData as ProcessContent;

export default function ProcessSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const revealCards = () => {
      section.querySelectorAll<HTMLElement>('.process-card').forEach((card) => {
        card.classList.add('is-visible');
      });
    };

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      revealCards();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        revealCards();
        observer.disconnect();
      },
      { threshold: 0.2 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="process"
      className="section content-section process-section numbered-section"
    >
      <header className="content-section-header dark-header">
        <div>
          <p className="section-kicker light">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
          <p className="content-section-subcopy">{content.subCopy}</p>
        </div>
        <SectionNumber sectionId="process" />
      </header>

      <div className="process-grid">
        {content.items.map((item, index) => (
          <article
            className="process-card"
            key={item.step}
            style={{ '--process-delay': `${index * 100}ms` } as CSSProperties}
          >
            <strong>{item.step}</strong>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
