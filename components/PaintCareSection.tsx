'use client';

import { Smartphone } from 'lucide-react';
import SectionNumber from '@/components/SectionNumber';
import polishData from '@/content/polish.json';
import siteData from '@/content/site.json';
import type { PolishContent, SiteContent } from '@/content/types';
import { trackSmsClick } from '@/lib/analytics';

const content = polishData as PolishContent;
const site = siteData as SiteContent;

export default function PaintCareSection() {
  return (
    <section
      id="paint-care"
      className="section content-section paint-care-section numbered-section"
    >
      <header className="content-section-header">
        <div>
          <p className="section-kicker">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
          <p className="content-section-subcopy">{content.subCopy}</p>
        </div>
        <SectionNumber sectionId="paint-care" />
      </header>

      <p className="paint-care-note">{content.note}</p>
      <div className="paint-care-grid">
        {content.items.map((item) => (
          <article className="paint-care-card" key={item.id}>
            <div className="compact-card-top">
              <span>{item.no}</span>
              <strong>{item.days}</strong>
            </div>
            <h3>{item.title}</h3>
            <p className="paint-care-keywords">{item.keywords}</p>
            <p className="paint-care-desc">{item.desc}</p>
            {item.notWhen && (
              <div className="paint-care-limit">
                <strong>이런 경우는</strong>
                <p>{item.notWhen}</p>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="section-closing paint-care-closing">
        <p>{content.closing}</p>
        {content.cta.type === 'sms' && (
          <a
            className="primary-action"
            href={site.contact.smsHref}
            onClick={trackSmsClick}
          >
            <Smartphone aria-hidden="true" />
            {content.cta.label}
          </a>
        )}
      </div>
    </section>
  );
}
