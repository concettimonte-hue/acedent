// Only these coarse labels cross the network. Never send raw referrers,
// search terms, UTM text, click IDs, or arbitrary external hostnames to D1.
export const VISIT_SOURCES = {
  'naver-search': '네이버 검색',
  'naver-blog': '네이버 블로그',
  'naver-place': '네이버 플레이스·지도',
  'naver-other': '네이버 기타',
  'naver-ad': '네이버 광고 표식',
  google: '구글',
  'google-ad': '구글 광고 표식',
  daum: '다음',
  bing: '빙',
  social: 'SNS·메신저',
  other: '기타 외부 사이트',
  direct: '직접·출처 확인 불가',
  internal: '사이트 내 이동·출처 확인 불가',
} as const;

export type VisitSource = keyof typeof VISIT_SOURCES;
export function isVisitSource(value: unknown): value is VisitSource {
  return typeof value === 'string' && Object.hasOwn(VISIT_SOURCES, value);
}

const domainIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function visitSource(referrer: string, location: string): VisitSource {
  let current: URL;
  try { current = new URL(location); } catch { return 'direct'; }
  const params = current.searchParams;
  const source = (params.get('utm_source') || '').toLowerCase().trim();
  const paid = /^(cpc|ppc|paid|paidsearch|paid_search)$/.test((params.get('utm_medium') || '').toLowerCase().trim());
  if (['gclid', 'gbraid', 'wbraid'].some((key) => Boolean(params.get(key))) || (source === 'google' && paid)) return 'google-ad';
  if (source === 'naver' && paid) return 'naver-ad';
  // Explicit campaign tags take precedence, but arbitrary values are never stored.
  if (source === 'google') return 'google';
  if (['naver_blog', 'naver-blog'].includes(source)) return 'naver-blog';
  if (['naver_place', 'naver-place'].includes(source)) return 'naver-place';
  if (source === 'naver') return 'naver-other';
  if (source === 'daum') return 'daum';
  if (source === 'bing') return 'bing';
  if (['instagram', 'facebook', 'kakao', 'kakaotalk'].includes(source)) return 'social';
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol === 'android-app:' && url.hostname === 'com.google.android.googlequicksearchbox') return 'google';
    if (!['https:', 'http:'].includes(url.protocol)) return 'direct';
    host = url.hostname.toLowerCase().replace(/\.$/, '');
  } catch { return 'direct'; }
  if (host === current.hostname || domainIs(host, 'acedentshop.co.kr')) return 'internal';
  if (domainIs(host, 'search.naver.com')) return 'naver-search';
  if (domainIs(host, 'blog.naver.com')) return 'naver-blog';
  if (domainIs(host, 'place.naver.com') || domainIs(host, 'map.naver.com')) return 'naver-place';
  if (domainIs(host, 'naver.com') || domainIs(host, 'naver.me')) return 'naver-other';
  if (domainIs(host, 'google.com') || domainIs(host, 'google.co.kr') || host === 'com.google.android.googlequicksearchbox') return 'google';
  if (domainIs(host, 'daum.net')) return 'daum';
  if (domainIs(host, 'bing.com')) return 'bing';
  if (['instagram.com', 'facebook.com', 'kakao.com', 't.co'].some((domain) => domainIs(host, domain))) return 'social';
  return 'other';
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
}
