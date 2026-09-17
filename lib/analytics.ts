export type TelClickLocation = '상단' | '하단' | '플로팅';

interface AnalyticsWindow extends Window {
  gtag?: (...args: unknown[]) => void;
  clarity?: (...args: unknown[]) => void;
  __acedentSpaTrackingInitialized?: boolean;
}

function getAnalyticsWindow() {
  return window as AnalyticsWindow;
}

function isAdminPath(pathname = window.location.pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function isOwnerExcluded() {
  return document.cookie
    .split(';')
    .some((item) => item.trim() === 'acedent_owner_excluded=1');
}

function sendEvent(name: string, params: Record<string, unknown>) {
  if (isAdminPath() || isOwnerExcluded()) return;
  getAnalyticsWindow().gtag?.('event', name, params);
}

function recordPrivateVisit(pathname = window.location.pathname) {
  if (isAdminPath(pathname) || isOwnerExcluded()) return;
  void fetch('/api/visit', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: pathname }),
  }).catch(() => {
    // 방문 통계 실패가 공개 페이지 이용을 방해하지 않도록 조용히 건너뜁니다.
  });
}

export function initializeSpaPageViews() {
  const analyticsWindow = getAnalyticsWindow();
  if (analyticsWindow.__acedentSpaTrackingInitialized) return;
  analyticsWindow.__acedentSpaTrackingInitialized = true;

  let lastPageKey = `${window.location.pathname}${window.location.search}`;
  let lastPrivatePath = window.location.pathname;
  let pendingPageView = 0;

  sendEvent('page_view', {
    page_location: window.location.href,
    page_title: document.title,
  });
  recordPrivateVisit();

  const schedulePageView = () => {
    const pageKey = `${window.location.pathname}${window.location.search}`;
    const requestId = ++pendingPageView;

    window.setTimeout(() => {
      if (requestId !== pendingPageView || pageKey === lastPageKey) return;
      lastPageKey = pageKey;
      if (isAdminPath()) return;

      sendEvent('page_view', {
        page_location: window.location.href,
        page_title: document.title,
      });
      if (window.location.pathname !== lastPrivatePath) {
        lastPrivatePath = window.location.pathname;
        recordPrivateVisit();
      }
    }, 0);
  };

  const originalPushState = window.history.pushState;
  window.history.pushState = function (...args) {
    originalPushState.apply(this, args);
    schedulePageView();
  };

  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    schedulePageView();
  };

  window.addEventListener('popstate', schedulePageView);
}

export function trackTelClick(location: TelClickLocation) {
  sendEvent('tel_click', {
    transport_type: 'beacon',
    location,
  });
  if (!isAdminPath() && !isOwnerExcluded()) {
    getAnalyticsWindow().clarity?.('set', 'conversion', 'tel');
  }
}

export function trackSmsClick() {
  sendEvent('sms_click', { transport_type: 'beacon' });
  if (!isAdminPath() && !isOwnerExcluded()) {
    getAnalyticsWindow().clarity?.('set', 'conversion', 'sms');
  }
}

export function trackCaseView(caseId: string, part: string) {
  sendEvent('case_view', { case_id: caseId, part });
}

export function trackFilterUse(category: string, part: string) {
  sendEvent('filter_use', { category, part });
}

export type WorksNavigationLocation =
  | 'header_desktop'
  | 'header_mobile'
  | 'bottom_mobile';

export function trackWorksNavigation(location: WorksNavigationLocation) {
  sendEvent('works_nav_click', { location });
}
