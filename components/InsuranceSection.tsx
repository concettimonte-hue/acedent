'use client';

import { ArrowUpRight, Check } from 'lucide-react';
import insuranceData from '@/content/insurance.json';
import type { InsuranceContent } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const content = insuranceData as InsuranceContent;

export default function InsuranceSection() {
  return (
    <section
      id="insurance"
      className="section content-section insurance-section"
    >
      <header className="content-section-header">
        <div>
          <p className="section-kicker">{content.sectionLabel}</p>
          <h2>{content.heading}</h2>
          <p className="content-section-subcopy">{content.subCopy}</p>
        </div>
        <span className="content-section-number">05</span>
      </header>

      <p className="insurance-assumption">{content.assumption}</p>
      <div className="insurance-table-scroll">
        <table className="insurance-table">
          <thead>
            <tr>
              <th scope="col">예상 수리비</th>
              <th scope="col">자기부담금</th>
              <th scope="col">판단 기준</th>
            </tr>
          </thead>
          <tbody>
            {content.table.map((row) => (
              <tr className={`insurance-${row.status}`} key={row.estimate}>
                <th scope="row">{row.estimate}</th>
                <td>{row.own}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="insurance-choice-grid">
        <article>
          <h3>현금이 나은 경우</h3>
          <ul>
            {content.cashBetter.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>보험이 나은 경우</h3>
          <ul>
            {content.insuranceBetter.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="section-closing insurance-closing">
        <p>{content.closing}</p>
        <a
          href={withLandingUtm(content.moreLink.url, 'blog')}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content.moreLink.label} <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
