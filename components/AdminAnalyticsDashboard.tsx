'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vite SPA routes are intentional. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminPagination from '@/components/AdminPagination';
import { matchesAdminSearch, paginateAdminRows } from '@/lib/admin-list';
import { analyticsComparison as comparison } from '@/lib/admin-analytics';
import {
  BarChart3,
  ExternalLink,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

type PeriodDays = 7 | 30 | 90;
type PageType = 'home' | 'works' | 'category' | 'detail' | 'other';

interface AnalyticsResult {
  excluded: boolean;
  trackingSince: string | null;
  period: {
    days: PeriodDays;
    start: string;
    end: string;
    visitors: number;
    views: number;
    previousVisitors: number;
    previousViews: number;
    previousStart: string;
    previousEnd: string;
    comparable: boolean;
  };
  stats: {
    todayVisitors: number;
    todayViews: number;
    allVisitors: number;
    allViews: number;
  };
  daily: Array<{ date: string; visitors: number; views: number }>;
  pageGroups: Array<{ type: PageType; visitors: number; views: number }>;
  topPages: Array<{
    path: string;
    label: string;
    type: PageType;
    visitors: number;
    views: number;
    previousVisitors: number;
    previousViews: number;
    registeredOn: string | null;
    isPublished: boolean;
  }>;
  error?: string;
}

const PERIODS: PeriodDays[] = [7, 30, 90];
const GROUP_LABELS: Record<PageType, string> = {
  home: '홈',
  works: '수리사례 목록',
  category: '카테고리·부위',
  detail: '사례 상세',
  other: '기타 페이지',
};

function shortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export default function AdminAnalyticsDashboard() {
  const [days, setDays] = useState<PeriodDays>(30);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [pageType, setPageType] = useState('detail');
  const [sort, setSort] = useState('visitors');
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedDay, setSelectedDay] = useState('');
  const requestId = useRef(0);
  const pagesHeading = useRef<HTMLElement>(null);

  const loadAnalytics = useCallback(async (period: PeriodDays) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const exclusionResponse = await fetch('/admin/api/analytics', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!exclusionResponse.ok) {
        const exclusionPayload = await exclusionResponse.json() as { error?: string };
        throw new Error(exclusionPayload.error || '관리자 방문 제외 설정에 실패했습니다.');
      }

      const response = await fetch(`/admin/api/analytics?days=${period}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json() as AnalyticsResult;
      if (!response.ok || !payload.period) throw new Error(payload.error || '방문 통계를 불러오지 못했습니다.');
      if (id === requestId.current) setAnalytics(payload);
    } catch (loadError) {
      if (id === requestId.current) setError(loadError instanceof Error ? loadError.message : '방문 통계를 불러오지 못했습니다.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics(days);
    return () => { requestId.current += 1; };
  }, [days, loadAnalytics]);

  const dailyRows = useMemo(() => {
    if (!analytics) return [];
    const rows = new Map(analytics.daily.map((row) => [row.date, row]));
    const end = new Date(`${analytics.period.end}T12:00:00+09:00`);
    return Array.from({ length: analytics.period.days }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (analytics.period.days - index - 1));
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      return rows.get(key) || { date: key, visitors: 0, views: 0 };
    });
  }, [analytics]);

  const maxDailyViews = Math.max(1, ...dailyRows.map((row) => row.views));
  const visitorTrend = analytics ? comparison(analytics.period.visitors, analytics.period.previousVisitors) : null;
  const viewTrend = analytics ? comparison(analytics.period.views, analytics.period.previousViews) : null;
  const groupMap = new Map(analytics?.pageGroups.map((row) => [row.type, row]) || []);
  const filteredPages = useMemo(() => (analytics?.topPages || []).filter((page) => (
    (!pageType || page.type === pageType) && matchesAdminSearch(query, page.label, page.path)
  )).sort((a, b) => {
    if (sort === 'quiet') return a.views - b.views || a.path.localeCompare(b.path);
    if (sort === 'new') return (b.registeredOn || '').localeCompare(a.registeredOn || '') || a.path.localeCompare(b.path);
    return sort === 'views' ? b.views - a.views : b.visitors - a.visitors || b.views - a.views;
  }), [analytics, query, pageType, sort]);
  const pagination = paginateAdminRows(filteredPages, pageNumber);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" aria-label="에이스덴트 홈페이지">ACE DENT</a>
        <div><span>ADMIN</span><strong>방문 통계</strong></div>
      </header>

      <section className="admin-list-shell admin-analytics-shell">
        <nav className="admin-section-nav" aria-label="관리자 메뉴">
          <a href="/admin">사례 관리</a>
          <a className="is-active" href="/admin?view=analytics">방문 통계</a>
        </nav>

        <div className="admin-list-heading admin-analytics-title">
          <div>
            <span>PRIVATE ANALYTICS</span>
            <h1>사이트 방문 통계</h1>
            <p>나의 방문을 제외하고, 방문자가 어떤 공개 페이지를 확인했는지 집계합니다.</p>
          </div>
          <button type="button" onClick={() => void loadAnalytics(days)} disabled={loading}>
            <RefreshCw aria-hidden="true" /> 새로고침
          </button>
        </div>

        <div className="admin-analytics-period" aria-label="통계 기간">
          {PERIODS.map((period) => (
            <button
              className={days === period ? 'is-active' : ''}
              key={period}
              type="button"
              aria-pressed={days === period}
              onClick={() => { setDays(period); setPageNumber(1); setSelectedDay(''); }}
            >
              {period}일
            </button>
          ))}
        </div>

        {error ? (
          <div className="admin-analytics-empty is-error" role="alert">{error}</div>
        ) : loading || !analytics ? (
          <div className="admin-analytics-empty">방문 통계를 불러오는 중입니다.</div>
        ) : (
          <>
            <p className="admin-browse-hint">한국시간 · {analytics.period.start} ~ {analytics.period.end} (어제까지) / 비교: {analytics.period.previousStart} ~ {analytics.period.previousEnd}{!analytics.period.comparable && ' · 이전 기간의 수집 기간이 충분하지 않아 증감은 참고용입니다.'}</p>
            <section className="admin-analytics-metrics" aria-label={`${days}일 핵심 지표`}>
              <article>
                <span><Users aria-hidden="true" /> 방문자</span>
                <strong>{analytics.period.visitors.toLocaleString()}<small>명</small></strong>
                <p className={`is-${visitorTrend?.direction}`}>
                  {visitorTrend?.direction === 'up' && <TrendingUp aria-hidden="true" />}
                  {visitorTrend?.direction === 'down' && <TrendingDown aria-hidden="true" />}
                  {analytics.period.comparable ? visitorTrend?.text : '비교 기간 수집 부족'}
                </p>
              </article>
              <article>
                <span><BarChart3 aria-hidden="true" /> 페이지 조회</span>
                <strong>{analytics.period.views.toLocaleString()}<small>회</small></strong>
                <p className={`is-${viewTrend?.direction}`}>
                  {viewTrend?.direction === 'up' && <TrendingUp aria-hidden="true" />}
                  {viewTrend?.direction === 'down' && <TrendingDown aria-hidden="true" />}
                  {analytics.period.comparable ? viewTrend?.text : '비교 기간 수집 부족'}
                </p>
              </article>
              <article>
                <span>방문자당 조회</span>
                <strong>{analytics.period.visitors ? (analytics.period.views / analytics.period.visitors).toFixed(1) : '0'}<small>회</small></strong>
                <p>{analytics.period.start} – {analytics.period.end}</p>
              </article>
              <article>
                <span>오늘</span>
                <strong>{analytics.stats.todayVisitors.toLocaleString()}<small>명</small></strong>
                <p>조회 {analytics.stats.todayViews.toLocaleString()}회 · 집계 중</p>
              </article>
            </section>

            <section className="admin-analytics-section" aria-labelledby="analytics-flow-heading">
              <header>
                <div>
                  <span>PAGE REACH</span>
                  <h2 id="analytics-flow-heading">페이지 유형별 도달</h2>
                </div>
                <p>한 방문자가 여러 유형을 볼 수 있어 합계는 전체 방문자 수와 다를 수 있습니다.</p>
              </header>
              <div className="admin-analytics-groups">
                {(['home', 'works', 'category', 'detail'] as PageType[]).map((type) => {
                  const row = groupMap.get(type);
                  const visitors = row?.visitors || 0;
                  const width = analytics.period.visitors
                    ? Math.min(100, Math.round((visitors / analytics.period.visitors) * 100))
                    : 0;
                  return (
                    <article key={type}>
                      <div><strong>{GROUP_LABELS[type]}</strong><span>{visitors.toLocaleString()}명 · {row?.views.toLocaleString() || 0}회</span></div>
                      <div className="admin-analytics-progress" aria-label={`${GROUP_LABELS[type]} 방문자 비율 ${width}%`}>
                        <span style={{ width: `${width}%` }} />
                      </div>
                      <small>전체 방문자 대비 {width}%</small>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="admin-analytics-section" aria-labelledby="analytics-daily-heading">
              <header>
                <div>
                  <span>DAILY VIEWS</span>
                  <h2 id="analytics-daily-heading">일별 페이지 조회</h2>
                </div>
                <p>막대를 누르거나 마우스를 올리면 날짜별 방문자와 조회 수를 확인할 수 있습니다.</p>
              </header>
              <div className="admin-analytics-chart" data-days={days}>
                {dailyRows.map((row, index) => (
                  <button type="button" className="admin-analytics-day" key={row.date} onClick={() => setSelectedDay(`${row.date} · 집계 방문자 ${row.visitors}명 · 조회 ${row.views}회`)} title={`${row.date} · ${row.visitors}명 · ${row.views}회`} aria-label={`${row.date} · ${row.visitors}명 · ${row.views}회`}>
                    <span>{row.views || ''}</span>
                    <i style={{ height: `${Math.max(row.views ? 8 : 2, Math.round((row.views / maxDailyViews) * 100))}%` }} />
                    <small>{days === 7 || index % (days === 30 ? 5 : 15) === 0 || index === dailyRows.length - 1 ? shortDate(row.date) : ''}</small>
                  </button>
                ))}
              </div>
              <output className="admin-browse-hint">{selectedDay || '날짜 막대를 선택하면 상세 숫자를 보여드립니다.'}</output>
            </section>

            <section className="admin-analytics-section" aria-labelledby="analytics-pages-heading" ref={pagesHeading}>
              <header>
                <div>
                  <span>PAGE PERFORMANCE</span>
                  <h2 id="analytics-pages-heading">페이지별 방문 비교</h2>
                </div>
                <p>상위 20건 밖의 사례도 확인합니다. 기록이 없는 것은 실제 방문 0명을 의미하지 않습니다.</p>
              </header>
              <div className="admin-browse-controls">
                <label className="admin-browse-search">페이지 검색<input type="search" placeholder="제목, 차종 또는 주소" value={query} onChange={(event) => { setQuery(event.target.value); setPageNumber(1); }} /></label>
                <label>유형<select value={pageType} onChange={(event) => { setPageType(event.target.value); setPageNumber(1); }}><option value="">모든 페이지</option>{Object.entries(GROUP_LABELS).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select></label>
                <label>정렬<select value={sort} onChange={(event) => { setSort(event.target.value); setPageNumber(1); }}><option value="visitors">방문자 많은 순</option><option value="views">조회 많은 순</option><option value="quiet">조회 적은 순</option><option value="new">최근 등록순</option></select></label>
              </div>
              {filteredPages.length === 0 ? (
                <div className="admin-analytics-empty">이 조건에 맞는 페이지가 없습니다.</div>
              ) : (
                <ol className="admin-analytics-pages">
                  {pagination.rows.map((page, index) => {
                    const newlyRegistered = page.registeredOn && page.registeredOn > analytics.period.start;
                    return (
                      <li key={page.path}>
                        <span className="admin-analytics-rank">{String(pagination.start + index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{page.label}</strong>
                          <code>{page.path}</code>
                          {page.registeredOn && <small>등록 {page.registeredOn}{newlyRegistered ? (page.registeredOn > analytics.period.end ? ' · 집계 기간 이후 등록' : ' · 기간 중 등록') : ''}</small>}
                          {!page.isPublished && <small>현재 비공개 또는 삭제된 사례의 이전 기록</small>}
                        </div>
                        <span className="admin-analytics-type">{GROUP_LABELS[page.type]}</span>
                        <p>{page.views ? <><strong>{page.visitors.toLocaleString()}</strong>명 <span>{page.views.toLocaleString()}회</span></> : '집계 기록 없음'}<small>이전 {page.previousVisitors.toLocaleString()}명 · {page.previousViews.toLocaleString()}회</small><small>{!analytics.period.comparable ? '비교 기간 수집 부족' : newlyRegistered ? '등록 시점 차이 고려' : `방문자 ${comparison(page.visitors, page.previousVisitors).text}`}</small></p>
                        {page.isPublished && <a href={page.path} target="_blank" rel="noopener noreferrer" aria-label={`${page.label} 새 탭에서 보기`}>
                          <ExternalLink aria-hidden="true" />
                        </a>}
                      </li>
                    );
                  })}
                </ol>
              )}
              <AdminPagination {...pagination} total={filteredPages.length} onChange={(page) => { setPageNumber(page); pagesHeading.current?.scrollIntoView({ block: 'start' }); }} />
            </section>

            <aside className="admin-analytics-note">
              <p><strong>집계 기준</strong> {analytics.trackingSince ? `${analytics.trackingSince}부터` : '배포 후부터'} · 이 관리자 브라우저는 제외 쿠키가 설정됩니다. 쿠키 삭제·기기 변경 시 새 방문자로 계산될 수 있습니다.</p>
              <p><strong>검색 유입</strong> 검색어·노출·클릭은 GA4와 Search Console을 연결한 뒤 Google 보고서에서 확인하는 것이 가장 정확합니다.</p>
            </aside>
          </>
        )}
      </section>
    </main>
  );
}
