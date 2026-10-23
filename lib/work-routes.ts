import {
  WORK_CATEGORIES,
  isWorkCategory,
  isWorkPart,
  type WorkCategory,
  type WorkPart,
  type WorkItem,
} from '../content/works/types';
import { getWorkPartFromRouteSlug, getWorkPartLandingPath, hasWorkPartLanding } from './work-landings';
import { getWorkPartsForCategory } from './work-categories';
import { normalizeWorkPartName, SPARE_TIRE_COVER } from './work-part-taxonomy';

export interface WorkFilters {
  category?: WorkCategory;
  part?: WorkPart;
}

export function getWorkCategoryFromQuery(value: string | null) {
  if (!value) return undefined;
  if (isWorkCategory(value)) return value;
  return WORK_CATEGORIES.find((item) => item.label === value)?.id;
}

export function getWorkCategoryFromPath(pathname: string) {
  const normalizedPath = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  const match = normalizedPath.match(/^\/works\/([^/]+)$/);
  return match && isWorkCategory(match[1]) ? match[1] : undefined;
}

export function getWorkPartLandingFilters(pathname: string): WorkFilters | undefined {
  const normalizedPath = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  const match = normalizedPath.match(/^\/works\/([^/]+)\/([^/]+)$/);
  if (!match || !isWorkCategory(match[1])) return undefined;
  const part = getWorkPartFromRouteSlug(match[2]);
  return part ? { category: match[1], part } : undefined;
}

export function readWorkFilters(
  pathname: string,
  searchValue: string,
  fallbackCategory?: WorkCategory,
  fallbackPart?: WorkPart,
): WorkFilters {
  const search = new URLSearchParams(searchValue);
  const rawPart = search.get('part');
  const part = rawPart ? normalizeWorkPartName(rawPart) : undefined;
  const landingFilters = getWorkPartLandingFilters(pathname);

  return {
    category: landingFilters?.category ?? getWorkCategoryFromPath(pathname) ?? fallbackCategory,
    part: landingFilters?.part ?? (part && isWorkPart(part) ? part : fallbackPart),
  };
}

export function getWorksFilterUrl(
  category?: WorkCategory,
  part?: WorkPart,
  currentSearch = '',
) {
  const source = new URLSearchParams(currentSearch);
  const search = new URLSearchParams();

  if (part) search.set('part', part);
  for (const [key, value] of source) {
    if (key !== 'category' && key !== 'part') search.append(key, value);
  }

  const pathname = category ? `/works/${category}` : '/works';
  const query = search.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

export function getLegacyWorksRedirect(pathname: string, searchValue: string) {
  const normalizedPath = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/works') return undefined;

  const search = new URLSearchParams(searchValue);
  const category = getWorkCategoryFromQuery(search.get('category'));
  if (!category) return undefined;

  const rawPartValue = search.get('part');
  const partValue = rawPartValue ? normalizeWorkPartName(rawPartValue) : undefined;
  const part = partValue && isWorkPart(partValue) ? partValue : undefined;
  return getWorksFilterUrl(category, part, searchValue);
}

export function getWorksCanonicalPath(category?: WorkCategory) {
  return category ? `/works/${category}` : '/works';
}

/** Old wheel links remain useful while there are no actual wheel cases. */
export function getLegacyWheelRedirect(pathname: string, searchValue: string, works: readonly WorkItem[]) {
  const filters = readWorkFilters(pathname, searchValue);
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/works' && !getWorkCategoryFromPath(pathname) && !getWorkPartLandingFilters(pathname)) return undefined;
  if (filters.part !== '휠') return undefined;
  const parts = works.flatMap(work => getWorkPartsForCategory(work, filters.category));
  if (parts.includes('휠') || !parts.includes(SPARE_TIRE_COVER)) return undefined;
  const fallback = getWorksFilterUrl(filters.category, SPARE_TIRE_COVER, searchValue);
  if (!filters.category || !hasWorkPartLanding(works, filters.category, SPARE_TIRE_COVER)) return fallback;
  const queryIndex = fallback.indexOf('?');
  return getWorkPartLandingPath(filters.category, SPARE_TIRE_COVER) + (queryIndex < 0 ? '' : fallback.slice(queryIndex));
}
