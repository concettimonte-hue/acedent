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

function sendEvent(name: string, params: Record<string, unknown>) {
  if (isAdminPath()) return;
  getAnalyticsWindow().gtag?.('event', name, params);
}

export function initializeSpaPageViews() {
  const analyticsWindow = getAnalyticsWindow();
  if (analyticsWindow.__acedentSpaTrackingInitialized) return;
  analyticsWindow.__acedentSpaTrackingInitialized = true;

  let lastPageKey = `${window.location.pathname}${window.location.search}`;
  let pendingPageView = 0;

  sendEvent('page_view', {
    page_location: window.location.href,
    page_title: document.title,
  });

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
  if (!isAdminPath()) {
    getAnalyticsWindow().clarity?.('set', 'conversion', 'tel');
  }
}

export function trackSmsClick() {
  sendEvent('sms_click', { transport_type: 'beacon' });
  if (!isAdminPath()) {
    getAnalyticsWindow().clarity?.('set', 'conversion', 'sms');
  }
}

export function trackCaseView(caseId: string, part: string) {
  sendEvent('case_view', { case_id: caseId, part });
}

export function trackFilterUse(part: string) {
  sendEvent('filter_use', { part });
}
