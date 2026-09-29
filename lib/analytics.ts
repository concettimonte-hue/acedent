export type TelClickLocation = '상단' | '하단' | '플로팅';

export type ContactMethod = 'tel' | 'sms' | 'talk' | 'booking';
export type ContactPlacement =
  | 'home_header'
  | 'home_hero'
  | 'home_contact'
  | 'home_paint_care'
  | 'home_location'
  | 'home_case_modal'
  | 'mobile_sticky'
  | 'works_header'
  | 'works_sticky'
  | 'work_detail_contact'
  | 'site_footer_phone';
export type TalkClickPlacement =
  | 'home_contact'
  | 'mobile_sticky'
  | 'home_naver_connect'
  | 'works_sticky'
  | 'work_detail_contact';
export type BookingClickPlacement = 'home_naver_connect';
export type PlaceClickPlacement =
  | 'home_naver_connect'
  | 'home_location'
  | 'site_footer_address';
export type BlogClickPlacement =
  | 'home_naver_connect'
  | 'home_trust_bar'
  | 'home_cases_footer'
  | 'home_case_modal'
  | 'home_insurance'
  | 'site_footer_blog'
  | 'work_detail_body';
export type ReviewClickPlacement = 'home_reviews';

interface EventContext<Placement extends string> {
  placement: Placement;
  workSlug?: string;
}

interface ExternalEventContext<Placement extends string>
  extends EventContext<Placement> {
  destination: string;
}

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

function getContextParams<Placement extends string>({
  placement,
  workSlug,
}: EventContext<Placement>) {
  return {
    page_path: window.location.pathname,
    placement,
    ...(workSlug ? { work_slug: workSlug } : {}),
  };
}

function trackContactIntent(
  contactMethod: ContactMethod,
  context: EventContext<string>,
) {
  sendEvent('contact_intent', {
    ...getContextParams(context),
    contact_method: contactMethod,
    transport_type: 'beacon',
  });
}

function trackExternalClick(
  eventName: string,
  context: ExternalEventContext<string>,
) {
  sendEvent(eventName, {
    ...getContextParams(context),
    destination: context.destination,
    transport_type: 'beacon',
  });
}

function getLegacyTelLocation(placement: ContactPlacement): TelClickLocation {
  if (placement === 'mobile_sticky' || placement === 'works_sticky') {
    return '플로팅';
  }
  if (
    placement === 'home_header' ||
    placement === 'home_hero' ||
    placement === 'works_header'
  ) {
    return '상단';
  }
  return '하단';
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

export function trackTelClick(
  placement: ContactPlacement,
  workSlug?: string,
) {
  const context = { placement, workSlug };
  sendEvent('tel_click', {
    ...getContextParams(context),
    transport_type: 'beacon',
    // 기존 GA4 보고서의 상단/하단/플로팅 구분은 계속 유지합니다.
    location: getLegacyTelLocation(placement),
  });
  trackContactIntent('tel', context);
  if (!isAdminPath() && !isOwnerExcluded()) {
    getAnalyticsWindow().clarity?.('set', 'conversion', 'tel');
  }
}

export function trackSmsClick(
  placement: ContactPlacement,
  workSlug?: string,
) {
  const context = { placement, workSlug };
  sendEvent('sms_click', {
    ...getContextParams(context),
    transport_type: 'beacon',
  });
  trackContactIntent('sms', context);
  if (!isAdminPath() && !isOwnerExcluded()) {
    getAnalyticsWindow().clarity?.('set', 'conversion', 'sms');
  }
}

export function trackTalkClick(
  placement: TalkClickPlacement,
  destination: string,
  workSlug?: string,
) {
  const context = { placement, destination, workSlug };
  trackExternalClick('talk_click', context);
  trackContactIntent('talk', context);
}

export function trackBookingClick(
  placement: BookingClickPlacement,
  destination: string,
) {
  const context = { placement, destination };
  trackExternalClick('booking_click', context);
  trackContactIntent('booking', context);
}

export function trackPlaceClick(
  placement: PlaceClickPlacement,
  destination: string,
) {
  trackExternalClick('place_click', { placement, destination });
}

export function trackBlogClick(
  placement: BlogClickPlacement,
  destination: string,
  workSlug?: string,
) {
  trackExternalClick('blog_click', { placement, destination, workSlug });
}

export function trackReviewClick(
  placement: ReviewClickPlacement,
  destination: string,
) {
  trackExternalClick('review_click', { placement, destination });
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
