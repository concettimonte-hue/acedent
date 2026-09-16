'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  WORK_CATEGORIES,
  WORK_PART_FILTER_ORDER,
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkPart,
} from '@/content/works/types';
import { getWorks, getWorksByCategory } from '@/lib/works';
import { applyClientMetadata, getWorksMetadata } from '@/lib/work-metadata';
import { getWorkPartsForCategory } from '@/lib/work-categories';
import WorkCard from '@/components/WorkCard';
import SiteFooter from '@/components/SiteFooter';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';
import { trackFilterUse } from '@/lib/analytics';
import {
  getWorksFilterUrl,
  readWorkFilters,
  type WorkFilters,
} from '@/lib/work-routes';

interface WorksGalleryPageProps {
  category?: WorkCategory;
}

function readFilters(fallbackCategory?: WorkCategory): WorkFilters {
  return readWorkFilters(
    window.location.pathname,
    window.location.search,
    fallbackCategory,
  );
}

function getFilterUrl(category?: WorkCategory, part?: WorkPart) {
  return getWorksFilterUrl(category, part, window.location.search);
}

function useFilterRail<T extends HTMLElement>(activeValue?: string) {
  const railRef = useRef<T>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    setCanScrollLeft(rail.scrollLeft > 3);
    setCanScrollRight(rail.scrollLeft < maxScrollLeft - 3);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(rail);
    window.addEventListener('resize', measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !window.matchMedia('(max-width: 680px)').matches) return;
    const activeItem = rail.querySelector<HTMLElement>('.is-active');
    if (!activeItem) return;

    const targetLeft = Math.max(
      0,
      activeItem.offsetLeft - (rail.clientWidth - activeItem.offsetWidth) / 2,
    );
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.scrollTo({ left: targetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeValue]);

  return { railRef, canScrollLeft, canScrollRight, measure };
}

function FilterRailEdges({ left, right }: { left: boolean; right: boolean }) {
  return (
    <>
      <span
        className={`work-filter-edge is-left${left ? ' is-visible' : ''}`}
        aria-hidden="true"
      >
        <ChevronLeft />
      </span>
      <span
        className={`work-filter-edge is-right${right ? ' is-visible' : ''}`}
        aria-hidden="true"
      >
        <ChevronRight />
      </span>
    </>
  );
}

export default function WorksGalleryPage({ category }: WorksGalleryPageProps) {
  const [filters, setFilters] = useState<WorkFilters>(() => readFilters(category));
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const selectedCategory = filters.category;
  const selectedPart = filters.part;
  const categoryRail = useFilterRail<HTMLElement>(selectedCategory ?? 'all');
  const partRail = useFilterRail<HTMLDivElement>(selectedPart ?? 'all');
  const categoryWorks = useMemo(
    () => (selectedCategory ? getWorksByCategory(selectedCategory) : getWorks()),
    [selectedCategory],
  );
  const availableFilterParts = useMemo(
    () => WORK_PART_FILTER_ORDER.filter((part) =>
      categoryWorks.some((work) =>
        getWorkPartsForCategory(work, selectedCategory).includes(part),
      ),
    ),
    [categoryWorks, selectedCategory],
  );
  const visibleWorks = useMemo(
    () =>
      selectedPart
        ? categoryWorks.filter((work) =>
          getWorkPartsForCategory(work, selectedCategory).includes(selectedPart),
        )
        : categoryWorks,
    [categoryWorks, selectedCategory, selectedPart],
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

  useEffect(() => {
    try {
      setShowSwipeHint(sessionStorage.getItem('acedent:works-filter-hint') !== 'seen');
    } catch {
      setShowSwipeHint(true);
    }
  }, []);

  useEffect(() => {
    if (!selectedPart || availableFilterParts.includes(selectedPart)) return;
    window.history.replaceState({}, '', getFilterUrl(selectedCategory));
    setFilters({ category: selectedCategory });
  }, [availableFilterParts, selectedCategory, selectedPart]);

  const analyticsCategory = selectedCategory
    ? getWorkCategoryLabel(selectedCategory)
    : '전체';

  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try {
      sessionStorage.setItem('acedent:works-filter-hint', 'seen');
    } catch {
      // 저장소를 사용할 수 없어도 안내만 숨기고 필터 동작은 유지합니다.
    }
  };

  const hasOverflowingFilter = categoryRail.canScrollRight || partRail.canScrollRight;

  return (
    <>
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
        <div className="work-filter-group">
          <div className="work-filter-heading">
            <span>작업 방식</span>
            {showSwipeHint && hasOverflowingFilter && (
              <span className="work-filter-swipe-hint">좌우로 밀어 선택 →</span>
            )}
          </div>
          <div
            className={`work-filter-rail-shell${categoryRail.canScrollLeft ? ' can-scroll-left' : ''}${categoryRail.canScrollRight ? ' can-scroll-right' : ''}`}
          >
            <nav
              ref={categoryRail.railRef}
              className="work-category-tabs"
              aria-label="작업방식"
              onPointerDown={dismissSwipeHint}
              onScroll={() => {
                categoryRail.measure();
                if ((categoryRail.railRef.current?.scrollLeft ?? 0) > 3) {
                  dismissSwipeHint();
                }
              }}
            >
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
            <FilterRailEdges
              left={categoryRail.canScrollLeft}
              right={categoryRail.canScrollRight}
            />
          </div>
        </div>

        <div className="work-filter-group">
          <div className="work-filter-heading">
            <span>수리 부위</span>
          </div>
          <div
            className={`work-filter-rail-shell${partRail.canScrollLeft ? ' can-scroll-left' : ''}${partRail.canScrollRight ? ' can-scroll-right' : ''}`}
          >
            <div
              ref={partRail.railRef}
              className="work-part-filter"
              aria-label="작업 부위 필터"
              onPointerDown={dismissSwipeHint}
              onScroll={() => {
                partRail.measure();
                if ((partRail.railRef.current?.scrollLeft ?? 0) > 3) {
                  dismissSwipeHint();
                }
              }}
            >
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
              {availableFilterParts.map((part) => (
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
            <FilterRailEdges
              left={partRail.canScrollLeft}
              right={partRail.canScrollRight}
            />
          </div>
        </div>

        <div className="works-count">
          <span>{selectedPart ? `${selectedPart} · ` : ''}{visibleWorks.length}건</span>
        </div>

        {visibleWorks.length > 0 ? (
          <div className="works-grid">
            {visibleWorks.map((work) => (
              <WorkCard
                work={work}
                contextCategory={selectedCategory}
                contextPart={selectedPart}
                imageState="before"
                key={work.slug}
              />
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
      <SiteFooter />
    </>
  );
}
