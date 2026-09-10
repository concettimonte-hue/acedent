'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  WORK_CATEGORIES,
  WORK_PARTS,
  getWorkCategoryLabel,
  isWorkCategory,
  isWorkPart,
  type WorkCategory,
  type WorkPart,
} from '@/content/works/types';
import { getWorks, getWorksByCategory } from '@/lib/works';
import { applyClientMetadata, getWorksMetadata } from '@/lib/work-metadata';
import WorkCard from '@/components/WorkCard';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';
import { trackFilterUse } from '@/lib/analytics';

interface WorksGalleryPageProps {
  category?: WorkCategory;
}

interface WorkFilters {
  category?: WorkCategory;
  part?: WorkPart;
}

function categoryFromQuery(value: string | null) {
  if (!value) return undefined;
  if (isWorkCategory(value)) return value;
  return WORK_CATEGORIES.find((item) => item.label === value)?.id;
}

function categoryFromPath(pathname: string) {
  const match = pathname.match(/^\/works\/([^/]+)\/?$/);
  return match && isWorkCategory(match[1]) ? match[1] : undefined;
}

function readFilters(fallbackCategory?: WorkCategory): WorkFilters {
  const search = new URLSearchParams(window.location.search);
  const part = search.get('part');

  return {
    category:
      categoryFromQuery(search.get('category')) ??
      categoryFromPath(window.location.pathname) ??
      fallbackCategory,
    part: part && isWorkPart(part) ? part : undefined,
  };
}

function getFilterUrl(category?: WorkCategory, part?: WorkPart) {
  const search = new URLSearchParams(window.location.search);

  if (category) search.set('category', getWorkCategoryLabel(category));
  else search.delete('category');

  if (part) search.set('part', part);
  else search.delete('part');

  const query = search.toString();
  return `/works${query ? `?${query}` : ''}`;
}

export default function WorksGalleryPage({ category }: WorksGalleryPageProps) {
  const [filters, setFilters] = useState<WorkFilters>(() => readFilters(category));
  const selectedCategory = filters.category;
  const selectedPart = filters.part;
  const categoryWorks = useMemo(
    () => (selectedCategory ? getWorksByCategory(selectedCategory) : getWorks()),
    [selectedCategory],
  );
  const visibleWorks = useMemo(
    () =>
      selectedPart
        ? categoryWorks.filter((work) => work.part.includes(selectedPart))
        : categoryWorks,
    [categoryWorks, selectedPart],
  );

  const selectFilters = (next: WorkFilters) => {
    window.history.pushState({}, '', getFilterUrl(next.category, next.part));
    setFilters(next);
  };

  useEffect(() => {
    const syncFiltersFromUrl = () => setFilters(readFilters(category));
    window.addEventListener('popstate', syncFiltersFromUrl);
    return () => window.removeEventListener('popstate', syncFiltersFromUrl);
  }, [category]);

  useEffect(() => {
    applyClientMetadata(getWorksMetadata(selectedCategory));
  }, [selectedCategory]);

  const analyticsCategory = selectedCategory
    ? getWorkCategoryLabel(selectedCategory)
    : '전체';

  return (
    <main className="works-page">
      <WorksHeader />
      <section className="works-page-hero">
        <p>ACE DENT · REPAIR ARCHIVE</p>
        <h1>{selectedCategory ? getWorkCategoryLabel(selectedCategory) : '수리사례'}</h1>
        <span>
          실제 차량의 작업 전후를 확인하고 내 차와 비슷한 손상을 찾아보세요.
        </span>
      </section>

      <section className="works-browser" aria-label="수리사례 목록">
        <nav className="work-category-tabs" aria-label="작업방식">
          <a
            href={getFilterUrl(undefined, selectedPart)}
            className={!selectedCategory ? 'is-active' : ''}
            aria-current={!selectedCategory ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              trackFilterUse('전체', selectedPart ?? '전체');
              selectFilters({ part: selectedPart });
            }}
          >
            전체
          </a>
          {WORK_CATEGORIES.map((item) => (
            <a
              href={getFilterUrl(item.id, selectedPart)}
              className={selectedCategory === item.id ? 'is-active' : ''}
              aria-current={selectedCategory === item.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                trackFilterUse(item.label, selectedPart ?? '전체');
                selectFilters({ category: item.id, part: selectedPart });
              }}
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
            className={!selectedPart ? 'is-active' : ''}
            aria-pressed={!selectedPart}
            onClick={() => {
              trackFilterUse(analyticsCategory, '전체');
              selectFilters({ category: selectedCategory });
            }}
          >
            전체
          </button>
          {WORK_PARTS.map((part) => (
            <button
              type="button"
              className={selectedPart === part ? 'is-active' : ''}
              aria-pressed={selectedPart === part}
              onClick={() => {
                const nextPart = selectedPart === part ? undefined : part;
                trackFilterUse(analyticsCategory, nextPart ?? '전체');
                selectFilters({ category: selectedCategory, part: nextPart });
              }}
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
