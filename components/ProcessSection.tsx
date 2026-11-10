'use client';

import SectionNumber from '@/components/SectionNumber';
import processData from '@/content/process.json';
import type { ProcessContent } from '@/content/types';

const content = processData as ProcessContent;

export default function ProcessSection() {
  return (
    <section
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

      <ol className="process-grid" aria-label="상담부터 출고까지 진행 순서">
        {content.items.map((item) => (
          <li className="process-card is-visible" key={item.step}>
            <strong aria-hidden="true">{item.step}</strong>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
