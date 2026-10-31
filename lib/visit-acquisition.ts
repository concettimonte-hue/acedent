// Only these coarse labels cross the network. Never send raw referrers,
// search terms, UTM text, click IDs, or arbitrary external hostnames to D1.
export const VISIT_SOURCES = {
  'naver-search': '네이버 검색',
  'naver-blog': '네이버 블로그',
  'naver-place': '네이버 플레이스·지도',
  'naver-other': '네이버 기타·앱',
  'naver-ad': '네이버 광고 표식',
  google: '구글',
  'google-ad': '구글 광고 표식',
  daum: '다음',
  bing: '빙',
  social: 'SNS·메신저',
  'after-call-sms': '통화 후 문자',
  other: '기타 외부 사이트',
  direct: '직접·출처 확인 불가',
  internal: '사이트 내 이동·출처 확인 불가',
} as const;

export type VisitSource = keyof typeof VISIT_SOURCES;
export function isVisitSource(value: unknown): value is VisitSource {
  return typeof value === 'string' && Object.hasOwn(VISIT_SOURCES, value);
}

const domainIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export const VISIT_BASES = {
  'link-tag': '알려진 링크 표식',
  'ad-tag': '광고 클릭 표식',
  'web-referrer': '외부 사이트 출처',
  'app-referrer': '알려진 앱 출처',
  internal: '사이트 내 이동',
  'no-referrer': '출처 정보 없음',
  'unrecognized-tag': '링크 표식 미인식·출처 없음',
  'unsupported-referrer': '미지원 앱·출처 형식',
  'invalid-referrer': '출처 형식 확인 불가',
  legacy: '판별 근거 미수집',
} as const;
export type VisitBasis = keyof typeof VISIT_BASES;
export interface VisitAttribution { source: VisitSource; basis: VisitBasis }
export function isVisitBasis(value: unknown): value is VisitBasis {
  return typeof value === 'string' && Object.hasOwn(VISIT_BASES, value);
}

// Exact Android package IDs from NAVER Corp.'s Google Play listings. Only use
// these when the browser actually supplies an android-app referrer, never UA.
const APP_SOURCES: Record<string, VisitSource> = {
  'com.google.android.googlequicksearchbox': 'google',
  'com.nhn.android.search': 'naver-other', // An app entry is not proof of search.
  'com.nhn.android.blog': 'naver-blog',
  'com.nhn.android.nmap': 'naver-place',
};

export function visitAttribution(referrer: string, location: string): VisitAttribution {
  const result = (source: VisitSource, basis: VisitBasis): VisitAttribution => ({ source, basis });
  let current: URL;
  try { current = new URL(location); } catch { return result('direct', 'invalid-referrer'); }
  const params = current.searchParams;
  const source = (params.get('utm_source') || '').toLowerCase().trim();
  const medium = (params.get('utm_medium') || '').toLowerCase().trim();
  const paid = /^(cpc|ppc|paid|paidsearch|paid_search)$/.test(medium);
  if (['gclid', 'gbraid', 'wbraid'].some((key) => Boolean(params.get(key)))) return result('google-ad', 'ad-tag');
  if (source === 'google' && paid) return result('google-ad', 'link-tag');
  if (source === 'naver' && paid) return result('naver-ad', 'link-tag');
  // Explicit campaign tags take precedence, but arbitrary values are never stored.
  // Require the dedicated pair: other SMS campaigns must not be inferred as after-call messages.
  if (source === 'after_call' && medium === 'sms') return result('after-call-sms', 'link-tag');
  if (source === 'google') return result('google', 'link-tag');
  if (['naver_blog', 'naver-blog'].includes(source)) return result('naver-blog', 'link-tag');
  if (['naver_place', 'naver-place'].includes(source)) return result('naver-place', 'link-tag');
  if (source === 'naver') return result('naver-other', 'link-tag');
  if (source === 'daum') return result('daum', 'link-tag');
  if (source === 'bing') return result('bing', 'link-tag');
  if (['instagram', 'facebook', 'kakao', 'kakaotalk'].includes(source)) return result('social', 'link-tag');
  if (!referrer.trim()) return result('direct', [...params.keys()].some(key => key.startsWith('utm_')) ? 'unrecognized-tag' : 'no-referrer');
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol === 'android-app:' && Object.hasOwn(APP_SOURCES, url.hostname)) return result(APP_SOURCES[url.hostname], 'app-referrer');
    if (!['https:', 'http:'].includes(url.protocol)) return result('direct', 'unsupported-referrer');
    host = url.hostname.toLowerCase().replace(/\.$/, '');
  } catch { return result('direct', 'invalid-referrer'); }
  if (host === current.hostname || domainIs(host, 'acedentshop.co.kr')) return result('internal', 'internal');
  if (domainIs(host, 'search.naver.com')) return result('naver-search', 'web-referrer');
  if (domainIs(host, 'blog.naver.com')) return result('naver-blog', 'web-referrer');
  if (domainIs(host, 'place.naver.com') || domainIs(host, 'map.naver.com')) return result('naver-place', 'web-referrer');
  if (domainIs(host, 'naver.com') || domainIs(host, 'naver.me')) return result('naver-other', 'web-referrer');
  if (domainIs(host, 'google.com') || domainIs(host, 'google.co.kr') || host === 'com.google.android.googlequicksearchbox') return result('google', 'web-referrer');
  if (domainIs(host, 'daum.net')) return result('daum', 'web-referrer');
  if (domainIs(host, 'bing.com')) return result('bing', 'web-referrer');
  if (['instagram.com', 'facebook.com', 'kakao.com', 't.co'].some((domain) => domainIs(host, domain))) return result('social', 'web-referrer');
  return result('other', 'web-referrer');
}

export function visitSource(referrer: string, location: string): VisitSource {
  return visitAttribution(referrer, location).source;
}

export const VISIT_SESSION_SECONDS = 30 * 60;
export function activeVisitSession(cookie: string, now = Date.now()): string | null {
  const match = /^([a-f0-9-]{36})\.(\d{13})$/.exec(cookie);
  if (!match || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(match[1])) return null;
  const age = now - Number(match[2]);
  return age >= 0 && age < VISIT_SESSION_SECONDS * 1000 ? match[1] : null;
}

export interface AcquisitionRow {
  source: VisitSource;
  path: string;
  label: string;
  entries: number;
  isPublished: boolean;
}

export interface VisitAcquisition {
  available: boolean;
  error?: 'migration-required' | 'unavailable';
  trackingSince: string | null;
  total: number;
  rows: AcquisitionRow[];
  hours?: Array<{ source: VisitSource; hour: number; entries: number }>;
  evidence?: {
    available: boolean;
    error?: 'migration-required' | 'unavailable';
    rows: Array<{ source: VisitSource; basis: VisitBasis; entries: number }>;
  };
}

export const ENTRY_PAGE_TYPES = { home: '홈', works: '전체 목록', category: '카테고리·부위', detail: '상세사례', other: '기타' } as const;
export function entryPageType(path: string): keyof typeof ENTRY_PAGE_TYPES {
  if (path === '/') return 'home';
  if (path === '/works') return 'works';
  if (path.startsWith('/works/detail/')) return 'detail';
  if (path.startsWith('/works/')) return 'category';
  return 'other';
}
