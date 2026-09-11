import {
  WORK_CATEGORIES,
  isWorkCategory,
  isWorkPart,
  type WorkCategory,
  type WorkPart,
} from '../content/works/types';

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

export function readWorkFilters(
  pathname: string,
  searchValue: string,
  fallbackCategory?: WorkCategory,
): WorkFilters {
  const search = new URLSearchParams(searchValue);
  const part = search.get('part');

  return {
    category: getWorkCategoryFromPath(pathname) ?? fallbackCategory,
    part: part && isWorkPart(part) ? part : undefined,
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

  const partValue = search.get('part');
  const part = partValue && isWorkPart(partValue) ? partValue : undefined;
  return getWorksFilterUrl(category, part, searchValue);
}

export function getWorksCanonicalPath(category?: WorkCategory) {
  return category ? `/works/${category}` : '/works';
}
