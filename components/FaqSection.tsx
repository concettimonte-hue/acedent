'use client';
import SectionNumber from '@/components/SectionNumber';
import faqData from '@/content/faq.json';
import type { FaqContent } from '@/content/types';

const content = faqData as FaqContent;

export default function FaqSection() {
  return (
    <section
      id="faq"
      className="section content-section faq-section numbered-section"
    >
      <header className="content-section-header">
        <div>
          <p className="section-kicker">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
        </div>
        <SectionNumber sectionId="faq" />
      </header>

      <div className="faq-list">
        {content.items.map((item) => (
          <details className="faq-item" open={item.open} key={item.q}>
            <summary>
              <span>{item.q}</span>
              <span className="faq-symbol" aria-hidden="true" />
            </summary>
            <div className="faq-answer">
              <p>{item.a}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
