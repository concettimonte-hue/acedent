'use client';

import { useState } from 'react';
import faqData from '@/content/faq.json';
import type { FaqContent } from '@/content/types';

const content = faqData as FaqContent;

export default function FaqSection() {
  const [openItems, setOpenItems] = useState<Set<number>>(
    () =>
      new Set(
        content.items.flatMap((item, index) => (item.open ? [index] : [])),
      ),
  );

  const toggleItem = (index: number) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section id="faq" className="section content-section faq-section">
      <header className="content-section-header">
        <div>
          <p className="section-kicker">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
        </div>
        <span className="content-section-number">07</span>
      </header>

      <div className="faq-list">
        {content.items.map((item, index) => {
          const isOpen = openItems.has(index);
          const panelId = `faq-panel-${index}`;
          return (
            <article className="faq-item" key={item.q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleItem(index)}
                >
                  <span>{item.q}</span>
                  <span className="faq-symbol" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
              </h3>
              <div id={panelId} className="faq-answer" hidden={!isOpen}>
                <p>{item.a}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
