'use client';

import processData from '@/content/process.json';
import type { ProcessContent } from '@/content/types';

const content = processData as ProcessContent;

export default function ProcessSection() {
  return (
    <section id="process" className="section content-section process-section">
      <header className="content-section-header dark-header">
        <div>
          <p className="section-kicker light">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
          <p className="content-section-subcopy">{content.subCopy}</p>
        </div>
        <span className="content-section-number">06</span>
      </header>

      <div className="process-grid">
        {content.items.map((item) => (
          <article className="process-card" key={item.step}>
            <strong>{item.step}</strong>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
