export function analyticsDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function analyticsPeriod(days: number, now = new Date()) {
  const ago = (offset: number) => analyticsDate(new Date(now.getTime() - offset * 86_400_000));
  return { today: ago(0), start: ago(days), end: ago(1), previousStart: ago(days * 2), previousEnd: ago(days + 1) };
}

export type AnalyticsRangeDays = 7 | 30 | 90;
export type AnalyticsSelection = 'today' | 'yesterday' | 'date' | AnalyticsRangeDays;

export function shiftAnalyticsDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

// Calendar dates are KST dates, independent of the browser/server's local timezone.
export function selectedAnalyticsPeriod(params: URLSearchParams, now = new Date()) {
  const today = analyticsDate(now);
  const mode = params.get('period');
  const suppliedDate = params.get('date');
  if (suppliedDate !== null || mode === 'today' || mode === 'yesterday') {
    const date = suppliedDate ?? (mode === 'yesterday' ? shiftAnalyticsDate(today, -1) : today);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '0001-01-01' ||
      Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today) {
      throw new Error('오늘까지의 올바른 날짜를 선택해 주세요.');
    }
    const previous = shiftAnalyticsDate(date, -1);
    return {
      today, days: 1 as const, start: date, end: date,
      previousStart: previous, previousEnd: previous, isPartial: date === today,
    };
  }
  // Keep existing ?days=7/30/90 clients on complete days ending yesterday.
  const requested = Number(params.get('days') || 30);
  const days: AnalyticsRangeDays = requested === 7 || requested === 90 ? requested : 30;
  return { ...analyticsPeriod(days, now), days, isPartial: false };
}

export function analyticsComparison(current: number, previous: number) {
  if (previous === 0) return current === 0 ? { text: '집계 기록 없음', direction: 'same' } : { text: '이전 기록 없음', direction: 'same' };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { text: percent === 0 ? '이전 기간과 동일' : `${Math.abs(percent).toLocaleString()}% ${percent > 0 ? '증가' : '감소'}`, direction: percent === 0 ? 'same' : percent > 0 ? 'up' : 'down' };
}
