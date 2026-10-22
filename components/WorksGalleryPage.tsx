'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  WORK_PART_FILTER_ORDER,
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkPart,
} from '@/content/works/types';
import { getWorks, getWorksByCategory } from '@/lib/works';
import { applyClientMetadata, getWorksMetadata } from '@/lib/work-metadata';
import {
  getAvailableWorkCategories,
  getWorkPartsForCategory,
} from '@/lib/work-categories';
import WorkCard from '@/components/WorkCard';
import SiteFooter from '@/components/SiteFooter';
import WorksHeader from '@/components/WorksHeader';
import WorksQuickActions from '@/components/WorksQuickActions';
import WorksFloatingContact from '@/components/WorksFloatingContact';
import { trackFilterUse } from '@/lib/analytics';
import {
  getWorkPartLandingFilters,
  getWorksFilterUrl,
  readWorkFilters,
  type WorkFilters,
} from '@/lib/work-routes';
import {
  getWorkPartLandingPath,
  hasWorkPartLanding,
} from '@/lib/work-landings';
import { getWorkCategoryGuide } from '@/lib/work-seo';
import { observeAdminSession } from '@/lib/admin-session';

interface WorksGalleryPageProps {
  category?: WorkCategory;
  part?: WorkPart;
}

function readFilters(fallbackCategory?: WorkCategory, fallbackPart?: WorkPart): WorkFilters {
  return readWorkFilters(
    window.location.pathname,
    window.location.search,
    fallbackCategory,
    fallbackPart,
  );
}

function getFilterUrl(category?: WorkCategory, part?: WorkPart) {
  const fallbackUrl = getWorksFilterUrl(category, part, window.location.search);
  if (!category || !part || !hasWorkPartLanding(getWorks(), category, part)) {
    return fallbackUrl;
  }
  const queryIndex = fallbackUrl.indexOf('?');
  const preservedSearch = queryIndex >= 0 ? fallbackUrl.slice(queryIndex) : '';
  return `${getWorkPartLandingPath(category, part)}${preservedSearch}`;
}

function useFilterRail<T extends HTMLElement>(activeValue?: string, contentKey?: string) {
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
    // The available part chips can change without resizing the rail itself.
    measure();
    if (!rail || !window.matchMedia('(max-width: 680px)').matches) return;
    const activeItem = rail.querySelector<HTMLElement>('.is-active');
    if (!activeItem) return;

    const targetLeft = Math.max(
      0,
      activeItem.offsetLeft - (rail.clientWidth - activeItem.offsetWidth) / 2,
    );
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.scrollTo({ left: targetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeValue, contentKey, measure]);

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

export default function WorksGalleryPage({ category, part }: WorksGalleryPageProps) {
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => observeAdminSession(setCanEdit), []);
  const allWorks = useMemo(() => getWorks(), []);
  const availableCategories = useMemo(
    () => getAvailableWorkCategories(allWorks),
    [allWorks],
  );
  const [filters, setFilters] = useState<WorkFilters>(() => readFilters(category, part));
  const selectedCategory = filters.category;
  const selectedPart = filters.part;
  const categoryGuide = getWorkCategoryGuide(selectedCategory, selectedPart);
  const categoryRail = useFilterRail<HTMLElement>(selectedCategory ?? 'all');
  const partRail = useFilterRail<HTMLDivElement>(selectedPart ?? 'all', selectedCategory);
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
    // Initial route props are fallback only on mount, never for history entries.
    const syncFiltersFromUrl = () => setFilters(readFilters());
    window.addEventListener('popstate', syncFiltersFromUrl);
    return () => window.removeEventListener('popstate', syncFiltersFromUrl);
  }, []);

  useEffect(() => {
    const landingFilters = getWorkPartLandingFilters(window.location.pathname);
    const canonicalPart = landingFilters?.category === selectedCategory &&
      landingFilters?.part === selectedPart
      ? selectedPart
      : undefined;
    applyClientMetadata(getWorksMetadata(selectedCategory, canonicalPart, allWorks));
  }, [allWorks, selectedCategory, selectedPart]);

  useEffect(() => {
    if (!selectedPart || availableFilterParts.includes(selectedPart)) return;
    window.history.replaceState({}, '', getFilterUrl(selectedCategory));
    setFilters({ category: selectedCategory });
  }, [availableFilterParts, selectedCategory, selectedPart]);

  const analyticsCategory = selectedCategory
    ? getWorkCategoryLabel(selectedCategory)
    : '전체';

  const hasFilters = Boolean(selectedCategory || selectedPart);
  const resultLabel = hasFilters
    ? `${[selectedCategory ? getWorkCategoryLabel(selectedCategory) : '', selectedPart].filter(Boolean).join(' · ')} 사례`
    : '전체 수리사례';

  return (
    <>
      <main className="works-page">
        <WorksHeader />
        <section className="works-page-hero">
        <p>ACE DENT · REPAIR ARCHIVE</p>
        <h1>{selectedPart ? `${selectedPart} ` : ''}{selectedCategory ? getWorkCategoryLabel(selectedCategory) : '수리사례'}</h1>
        <span>
          작업 방식이나 손상 부위로 비슷한 사례를 찾아보세요. 아는 항목만 골라도 됩니다.
        </span>
        </section>

        {categoryGuide && (
          <details
            key={`${selectedCategory}-${selectedPart ?? 'all'}`}
            className="works-category-guide"
            aria-labelledby={`works-category-guide-${selectedCategory}`}
          >
            <summary>
              <h2 id={`works-category-guide-${selectedCategory}`}>{categoryGuide.title}</h2>
              <span className="works-category-guide-action">
                <span className="when-closed">설명 보기</span>
                <span className="when-open">접기</span>
              </span>
            </summary>
            <div className="works-category-guide-body">
              {categoryGuide.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        )}

        <section className="works-browser" aria-label="수리사례 목록">
        <div className="work-filter-group">
          <div className="work-filter-heading">
            <span id="work-category-question">어떤 작업이 궁금하세요?</span>
            {(categoryRail.canScrollLeft || categoryRail.canScrollRight) && (
              <span className="work-filter-swipe-hint">좌우로 보기 ↔</span>
            )}
          </div>
          <div
            className={`work-filter-rail-shell${categoryRail.canScrollLeft ? ' can-scroll-left' : ''}${categoryRail.canScrollRight ? ' can-scroll-right' : ''}`}
          >
            <nav
              ref={categoryRail.railRef}
              className="work-category-tabs"
              aria-label="작업방식"
              aria-describedby="work-category-question"
              onScroll={categoryRail.measure}
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
              {availableCategories.map((item) => (
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
            <span id="work-part-question">어디가 손상됐나요?</span>
            {(partRail.canScrollLeft || partRail.canScrollRight) && (
              <span className="work-filter-swipe-hint">좌우로 보기 ↔</span>
            )}
          </div>
          <div
            className={`work-filter-rail-shell${partRail.canScrollLeft ? ' can-scroll-left' : ''}${partRail.canScrollRight ? ' can-scroll-right' : ''}`}
          >
            <div
              ref={partRail.railRef}
              className="work-part-filter"
              role="group"
              aria-label="작업 부위 필터"
              aria-describedby="work-part-question"
              onScroll={partRail.measure}
            >
              <a
                href={getFilterUrl(selectedCategory)}
                className={!selectedPart ? 'is-active' : ''}
                aria-current={!selectedPart ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  trackFilterUse(analyticsCategory, '전체');
                  selectFilters({ category: selectedCategory });
                }}
              >
                전체
              </a>
              {availableFilterParts.map((part) => (
                <a
                  href={getFilterUrl(selectedCategory, selectedPart === part ? undefined : part)}
                  className={selectedPart === part ? 'is-active' : ''}
                  aria-current={selectedPart === part ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    const nextPart = selectedPart === part ? undefined : part;
                    trackFilterUse(analyticsCategory, nextPart ?? '전체');
                    selectFilters({ category: selectedCategory, part: nextPart });
                  }}
                  key={part}
                >
                  {part}
                </a>
              ))}
            </div>
            <FilterRailEdges
              left={partRail.canScrollLeft}
              right={partRail.canScrollRight}
            />
          </div>
        </div>

        <div className="works-count">
          <span role="status" aria-live="polite" aria-atomic="true">
            {resultLabel} <strong>{visibleWorks.length}건</strong>
          </span>
          {hasFilters && (
            <a
              className="works-filter-reset"
              href={getFilterUrl()}
              onClick={(event) => {
                event.preventDefault();
                trackFilterUse('전체', '전체');
                selectFilters({});
              }}
            >
              선택 초기화
            </a>
          )}
        </div>

        {visibleWorks.length > 0 ? (
          <div className="works-grid">
            {visibleWorks.map((work) => (
              <WorkCard
                work={work}
                contextCategory={selectedCategory}
                contextPart={selectedPart}
                imageState="before"
                canEdit={canEdit}
                showVehicleLogo
                key={work.slug}
              />
            ))}
          </div>
        ) : (
          <div className="works-empty">
            <strong>이 조건으로 등록된 사례가 없습니다.</strong>
            <p>수리 가능 여부와는 다릅니다. 다른 항목을 고르거나 선택을 초기화해 보세요.</p>
          </div>
        )}

        <a className="works-back-link" href="/#cases">
          <ArrowLeft aria-hidden="true" /> 메인 대표사례로 돌아가기
        </a>
        </section>

        <WorksQuickActions compact />
      </main>
      <SiteFooter />
      <WorksFloatingContact />
    </>
  );
}
