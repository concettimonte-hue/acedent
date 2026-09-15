'use client';

import { useEffect } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import WorkCard from '@/components/WorkCard';
import WorkClassification from '@/components/WorkClassification';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';
import WorkVehicleTag from '@/components/WorkVehicleTag';
import type { WorkItem } from '@/content/works/types';
import { getWorkCategoryLabel } from '@/content/works/types';
import { getWorkImageAlt, resolveWorkImageSrc } from '@/lib/work-images';
import {
  applyClientMetadata,
  getWorkMetadata,
} from '@/lib/work-metadata';
import { getRelatedWorks, getWorksByCategory } from '@/lib/works';
import { withLandingUtm } from '@/lib/tracking';

interface WorkDetailPageProps {
  work: WorkItem;
}

export default function WorkDetailPage({ work }: WorkDetailPageProps) {
  const relatedWorks = getRelatedWorks(work, 3);
  const categoryLabel = getWorkCategoryLabel(work.category);
  const categoryWorkCount = getWorksByCategory(work.category).length;

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
          <WorkClassification work={work} />
          <h1>{work.title}</h1>
          <div className="work-detail-meta">
            <WorkVehicleTag maker={work.carMaker} model={work.carModel} />
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
                <span>
                  PART {String(index + 1).padStart(2, '0')}
                  {part.category && ` · ${getWorkCategoryLabel(part.category)}`}
                </span>
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
                  enableZoom
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
          <div className="related-works-heading">
            <p>RELATED WORKS</p>
            <h2 id="related-works-title">비슷한 수리사례</h2>
            <p>같은 작업방식의 실제 전후 결과를 더 확인해보세요.</p>
          </div>
          <div className="works-grid related-works-grid">
            {relatedWorks.map((related) => (
              <WorkCard work={related} key={related.slug} />
            ))}
          </div>
          <a className="related-works-more" href={`/works/${work.category}`}>
            <span>
              <strong>{categoryLabel}</strong> 수리사례 {categoryWorkCount}건 전체 보기
            </span>
            <ArrowRight aria-hidden="true" />
          </a>
        </section>
      )}

      <section className="work-detail-contact" aria-labelledby="work-contact-title">
        <p>PHOTO CONSULTATION</p>
        <h2 id="work-contact-title">내 차도 비슷하게 손상됐나요?</h2>
        <p className="work-detail-contact-copy">
          손상 부위가 잘 보이는 사진을 보내주시면 수리 가능 여부와 예상 작업 범위를 먼저 안내드립니다.
        </p>
        <WorksQuickActions photoPrimary />
      </section>
    </main>
  );
}
