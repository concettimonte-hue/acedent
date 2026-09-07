'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  WORK_CATEGORIES,
  WORK_PARTS,
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkPart,
} from '@/content/works/types';
import { getWorks, getWorksByCategory } from '@/lib/works';
import { applyClientMetadata, getWorksMetadata } from '@/lib/work-metadata';
import WorkCard from '@/components/WorkCard';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';

interface WorksGalleryPageProps {
  category?: WorkCategory;
}

export default function WorksGalleryPage({ category }: WorksGalleryPageProps) {
  const [selectedPart, setSelectedPart] = useState<WorkPart | null>(null);
  const categoryWorks = category ? getWorksByCategory(category) : getWorks();
  const visibleWorks = useMemo(
    () =>
      selectedPart
        ? categoryWorks.filter((work) => work.part.includes(selectedPart))
        : categoryWorks,
    [categoryWorks, selectedPart],
  );

  useEffect(() => {
    applyClientMetadata(getWorksMetadata(category));
  }, [category]);

  return (
    <main className="works-page">
      <WorksHeader />
      <section className="works-page-hero">
        <p>ACE DENT · REPAIR ARCHIVE</p>
        <h1>{category ? getWorkCategoryLabel(category) : '수리사례'}</h1>
        <span>
          실제 차량의 작업 전후를 확인하고 내 차와 비슷한 손상을 찾아보세요.
        </span>
      </section>

      <section className="works-browser" aria-label="수리사례 목록">
        <nav className="work-category-tabs" aria-label="작업방식">
          <a href="/works" className={!category ? 'is-active' : ''}>
            전체
          </a>
          {WORK_CATEGORIES.map((item) => (
            <a
              href={`/works/${item.id}`}
              className={category === item.id ? 'is-active' : ''}
              aria-current={category === item.id ? 'page' : undefined}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="work-part-filter" aria-label="작업 부위 필터">
          <span>부위</span>
          <button
            type="button"
            className={selectedPart === null ? 'is-active' : ''}
            onClick={() => setSelectedPart(null)}
          >
            전체
          </button>
          {WORK_PARTS.map((part) => (
            <button
              type="button"
              className={selectedPart === part ? 'is-active' : ''}
              aria-pressed={selectedPart === part}
              onClick={() => setSelectedPart((current) => (current === part ? null : part))}
              key={part}
            >
              {part}
            </button>
          ))}
        </div>

        <div className="works-count">
          <span>{selectedPart ? `${selectedPart} · ` : ''}{visibleWorks.length}건</span>
        </div>

        {visibleWorks.length > 0 ? (
          <div className="works-grid">
            {visibleWorks.map((work) => (
              <WorkCard work={work} key={work.slug} />
            ))}
          </div>
        ) : (
          <div className="works-empty">
            <strong>등록된 사례가 없습니다.</strong>
            <p>다른 작업 부위를 선택해 주세요.</p>
          </div>
        )}

        <a className="works-back-link" href="/#cases">
          <ArrowLeft aria-hidden="true" /> 메인 대표사례로 돌아가기
        </a>
      </section>

      <WorksQuickActions compact />
    </main>
  );
}
