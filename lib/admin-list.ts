export const ADMIN_PAGE_SIZE = 20;

export function matchesAdminSearch(query: string, ...values: (string | undefined)[]) {
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
  const haystack = normalize(values.filter(Boolean).join(' '));
  return query.trim().split(/\s+/).every((word) => haystack.includes(normalize(word)));
}

export function paginateAdminRows<T>(rows: readonly T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(rows.length / ADMIN_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.trunc(requestedPage) || 1));
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  return { page, pages, start, rows: rows.slice(start, start + ADMIN_PAGE_SIZE) };
}
