export function analyticsDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function analyticsPeriod(days: number, now = new Date()) {
  const ago = (offset: number) => analyticsDate(new Date(now.getTime() - offset * 86_400_000));
  return { today: ago(0), start: ago(days), end: ago(1), previousStart: ago(days * 2), previousEnd: ago(days + 1) };
}

export function analyticsComparison(current: number, previous: number) {
  if (previous === 0) return current === 0 ? { text: '집계 기록 없음', direction: 'same' } : { text: '이전 기록 없음', direction: 'same' };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { text: percent === 0 ? '이전 기간과 동일' : `${Math.abs(percent).toLocaleString()}% ${percent > 0 ? '증가' : '감소'}`, direction: percent === 0 ? 'same' : percent > 0 ? 'up' : 'down' };
}
