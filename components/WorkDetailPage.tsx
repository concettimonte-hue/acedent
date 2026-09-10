'use client';

import { useEffect } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import WorkCard from '@/components/WorkCard';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';
import type { WorkItem } from '@/content/works/types';
import { getWorkCategoryLabel } from '@/content/works/types';
import { getWorkImageAlt, resolveWorkImageSrc } from '@/lib/work-images';
import {
  applyClientMetadata,
  getWorkMetadata,
} from '@/lib/work-metadata';
import { formatWorkCar, getRelatedWorks } from '@/lib/works';
import { withLandingUtm } from '@/lib/tracking';

interface WorkDetailPageProps {
  work: WorkItem;
}

export default function WorkDetailPage({ work }: WorkDetailPageProps) {
  const relatedWorks = getRelatedWorks(work, 3);
  const categoryLabel = getWorkCategoryLabel(work.category);

  useEffect(() => {
    applyClientMetadata(getWorkMetadata(work));
  }, [work]);

  return (
    <main className="works-page work-detail-page">
      <WorksHeader />

      <nav className="work-breadcrumb" aria-label="현재 위치">
        <a href="/">홈</a>
        <span>/</span>
        <a href="/works">수리사례</a>
        <span>/</span>
        <a href={`/works/${work.category}`}>{categoryLabel}</a>
      </nav>

      <article className="work-detail">
        <header className="work-detail-heading">
          <div className="work-detail-category-tags">
            <p>{categoryLabel}</p>
            {work.subCategories.map((category) => (
              <span key={category}>{getWorkCategoryLabel(category)}</span>
            ))}
          </div>
          <h1>{work.title}</h1>
          <div className="work-detail-meta">
            <span>{formatWorkCar(work)}</span>
            <span>{work.part[0]}</span>
            {work.subParts.map((part) => (
              <span className="work-detail-secondary-part" key={part}>{part}</span>
            ))}
            {work.color && <span>{work.color}</span>}
            <strong>{work.days}</strong>
          </div>
        </header>

        <div className="work-detail-parts">
          {work.parts.map((part, index) => (
            <section
              className="work-detail-part"
              key={`${part.label}-${index}`}
              aria-labelledby={`work-part-${index}`}
            >
              <header className="work-detail-part-heading">
                <span>PART {String(index + 1).padStart(2, '0')}</span>
                <h2 id={`work-part-${index}`}>{part.label}</h2>
                <p>{part.note}</p>
              </header>
              <div className="work-detail-slider">
                <BeforeAfterSlider
                  beforeSrc={resolveWorkImageSrc(part.before)}
                  afterSrc={resolveWorkImageSrc(part.after)}
                  beforeAlt={getWorkImageAlt(work, part, '전')}
                  afterAlt={getWorkImageAlt(work, part, '후')}
                  mode={work.sliderType}
                  priority={index === 0}
                  showHint={work.sliderType === 'drag'}
                />
              </div>
            </section>
          ))}
        </div>

        <div className="work-detail-copy">
          <p className="work-detail-summary">{work.summary}</p>
          {work.body.split('\n\n').map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {work.blogUrl && (
            <a
              className="work-blog-link"
              href={withLandingUtm(work.blogUrl, 'work_detail')}
              target="_blank"
              rel="noopener noreferrer"
            >
              블로그에서 더 보기 <ArrowUpRight aria-hidden="true" />
            </a>
          )}
        </div>
      </article>

      {relatedWorks.length > 0 && (
        <section className="related-works" aria-labelledby="related-works-title">
          <div>
            <p>RELATED WORKS</p>
            <h2 id="related-works-title">같은 작업방식 사례</h2>
          </div>
          <div className="works-grid related-works-grid">
            {relatedWorks.map((related) => (
              <WorkCard work={related} key={related.slug} />
            ))}
          </div>
          <a className="works-back-link" href={`/works/${work.category}`}>
            <ArrowLeft aria-hidden="true" /> {categoryLabel} 전체 보기
          </a>
        </section>
      )}

      <section className="work-detail-contact" aria-labelledby="work-contact-title">
        <p>CONTACT</p>
        <h2 id="work-contact-title">비슷한 손상이라면 사진으로 문의하세요.</h2>
        <WorksQuickActions />
      </section>
    </main>
  );
}
