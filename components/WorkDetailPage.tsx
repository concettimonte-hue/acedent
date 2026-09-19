'use client';

import { useEffect } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import WorkCard from '@/components/WorkCard';
import WorkClassification from '@/components/WorkClassification';
import WorkPhotoGallery from '@/components/WorkPhotoGallery';
import SiteFooter from '@/components/SiteFooter';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';
import WorkVehicleTag from '@/components/WorkVehicleTag';
import type { WorkItem } from '@/content/works/types';
import { getWorkCategoryLabel, isWorkPart } from '@/content/works/types';
import { getWorkDisplayCategories } from '@/lib/work-categories';
import { getWorkImageAlt, resolveWorkImageSrc } from '@/lib/work-images';
import {
  applyClientMetadata,
  getWorkMetadata,
} from '@/lib/work-metadata';
import { getWorkFilterParts } from '@/lib/work-parts';
import {
  getWorkPartLandingPath,
  hasWorkPartLanding,
} from '@/lib/work-landings';
import { getRelatedWorkReasonLabel } from '@/lib/work-related';
import {
  formatWorkCar,
  getRelatedWorkSuggestions,
  getWorks,
  getWorksByCategory,
} from '@/lib/works';
import { withLandingUtm } from '@/lib/tracking';

interface WorkDetailPageProps {
  work: WorkItem;
}

export default function WorkDetailPage({ work }: WorkDetailPageProps) {
  const relatedSuggestions = getRelatedWorkSuggestions(work, 3);
  const categoryLabel = getWorkCategoryLabel(work.category);
  const categoryWorkCount = getWorksByCategory(work.category).length;
  const allWorks = getWorks();
  const displayCategories = getWorkDisplayCategories(work);
  const displayParts = getWorkFilterParts(work);

  const getPartHref = (part: string) => {
    if (!isWorkPart(part)) return undefined;
    const matchedPart = work.parts.find((candidate) => candidate.part?.includes(part));
    const matchedCategory = matchedPart?.category ?? work.category;
    return hasWorkPartLanding(allWorks, matchedCategory, part)
      ? getWorkPartLandingPath(matchedCategory, part)
      : `/works/${matchedCategory}?part=${encodeURIComponent(part)}`;
  };

  useEffect(() => {
    applyClientMetadata(getWorkMetadata(work));
  }, [work]);

  return (
    <>
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
              {part.gallery && part.gallery.length > 0 && (
                <WorkPhotoGallery
                  images={part.gallery}
                  work={work}
                  part={part}
                  title="해당 부위 사진 더 보기"
                  compact
                />
              )}
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

        {work.gallery && work.gallery.length > 0 && (
          <WorkPhotoGallery
            images={work.gallery}
            work={work}
            label="MORE PHOTOS"
            title="사례 사진 더 보기"
          />
        )}

        <section className="work-result-summary" aria-labelledby="work-result-summary-title">
          <header>
            <p>RESULT SUMMARY</p>
            <h2 id="work-result-summary-title">이번 작업 한눈에 보기</h2>
          </header>
          <dl>
            <div>
              <dt>차량</dt>
              <dd>{formatWorkCar(work)}</dd>
            </div>
            <div>
              <dt>작업 부위</dt>
              <dd>
                {displayParts.map((part, index) => {
                  const href = getPartHref(part);
                  return (
                    <span key={part}>
                      {index > 0 && ' · '}
                      {href ? <a href={href}>{part}</a> : part}
                    </span>
                  );
                })}
              </dd>
            </div>
            <div>
              <dt>작업 분류</dt>
              <dd>
                {displayCategories.map((category, index) => (
                  <span key={category}>
                    {index > 0 && ' · '}
                    <a href={`/works/${category}`}>{getWorkCategoryLabel(category)}</a>
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>소요 기간</dt>
              <dd>{work.days}</dd>
            </div>
          </dl>
        </section>
      </article>

      {relatedSuggestions.length > 0 && (
        <section className="related-works" aria-labelledby="related-works-title">
          <div className="related-works-heading">
            <p>RELATED WORKS</p>
            <h2 id="related-works-title">비슷한 수리사례</h2>
            <p>같은 부위 또는 작업방식의 실제 전후 결과를 더 확인해보세요.</p>
          </div>
          <div className="works-grid related-works-grid">
            {relatedSuggestions.map(({
              work: related,
              reasons,
              matchedCategory,
              matchedPart,
            }) => (
              <WorkCard
                work={related}
                contextCategory={matchedCategory}
                contextPart={matchedPart}
                reasonLabels={reasons.map(getRelatedWorkReasonLabel)}
                imageState="before"
                key={related.slug}
              />
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
          <div className="work-detail-trust">
            <strong>수리가 필요한지, 교환이 나은지부터 확인해드립니다.</strong>
            <span>불필요한 작업은 권하지 않습니다.</span>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
