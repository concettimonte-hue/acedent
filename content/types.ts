export type ServiceIconName =
  | 'carFront'
  | 'wrench'
  | 'sparkles'
  | 'shieldCheck';
export type NaverIconName =
  | 'naver'
  | 'mapPin'
  | 'messageCircle'
  | 'calendarDays';
export type BeforeAfterMode = 'drag' | 'split';

export interface CaseItem {
  id: string;
  order: number;
  title: string;
  car: string;
  part: string;
  days: string;
  summary: string;
  beforeImg: string;
  afterImg: string;
  blogUrl: string;
  sliderType: BeforeAfterMode;
}

export interface CasesContent {
  sectionLabel: string;
  headingLines: [string, string];
  modalLinkLabel: string;
  items: CaseItem[];
}

export interface TrustItem {
  id: string;
  value: string;
  valueSuffix: string;
  label: string;
  sub: string;
  countUp: boolean;
  duration?: number;
  linkUrl?: string;
}

export interface ReviewItem {
  id: string;
  initial: string;
  car: string;
  area: string;
  part: string;
  highlight: boolean;
  headline: string;
  text: string;
}

export interface ReviewsContent {
  sectionLabel: string;
  heading: string;
  subCopy: string;
  moreLinkLabel: string;
  moreLinkUrl: string;
  reviews: ReviewItem[];
}

export interface FaqItem {
  q: string;
  a: string;
  open: boolean;
}

export type InsuranceStatus = 'safe' | 'warn' | 'danger';

export interface InsuranceContent {
  sectionLabel: string;
  heading: string;
  subCopy: string;
  assumption: string;
  table: Array<{
    estimate: string;
    own: string;
    note: string;
    status: InsuranceStatus;
  }>;
  cashBetter: string[];
  insuranceBetter: string[];
  closing: string;
  moreLink: {
    label: string;
    url: string;
  };
}

export interface ProcessItem {
  step: string;
  title: string;
  desc: string;
}

export interface NaverContent {
  blog: string;
  place: string;
  review: string;
  booking: string;
  talk: string;
}

export interface SiteContent {
  meta: {
    title: string;
    description: string;
  };
  brand: {
    name: string;
    descriptor: string;
    tagline: string;
    logoSrc: string;
    logoAlt: string;
    homeAriaLabel: string;
    footerHomeAriaLabel: string;
  };
  navigation: {
    ariaLabel: string;
    items: Array<{ label: string; href: string }>;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitleAccent: string;
    subtitle: string;
    descriptionLines: string[];
    phoneActionLabel: string;
    smsActionLabel: string;
    resultAriaLabel: string;
    resultKicker: string;
    resultNumber: string;
    beforeSrc: string;
    afterSrc: string;
    beforeAlt: string;
    afterAlt: string;
    mode: BeforeAfterMode;
    workLabel: string;
    workValue: string;
    resultLabel: string;
    resultValue: string;
  };
  services: {
    kicker: string;
    titleLines: [string, string];
    description: string;
    items: Array<{
      number: string;
      title: string;
      copy: string;
      icon: ServiceIconName;
    }>;
  };
  principles: {
    kicker: string;
    titleLines: [string, string];
    description: string;
    items: string[];
    reasonsKicker: string;
    reasonsTitle: string;
    reasons: Array<{ number: string; title: string; copy: string }>;
  };
  naverLinks: {
    kicker: string;
    naverSymbol: string;
    title: string;
    description: string;
    items: Array<{
      icon: NaverIconName;
      label: string;
      title: string;
      copy: string;
      href: string;
    }>;
  };
  contact: {
    kicker: string;
    titleLines: [string, string];
    description: string;
    phoneDisplay: string;
    phoneHref: string;
    smsHref: string;
    placeHref: string;
    phoneLabel: string;
    headerPhoneLabel: string;
    smsEyebrow: string;
    smsLabel: string;
    placeEyebrow: string;
    placeLabel: string;
    note: string;
    footerAddress: string;
    footerPhonePrefix: string;
    footerPlaceLabel: string;
    mobileNavAriaLabel: string;
    mobilePhoneLabel: string;
    mobileSmsLabel: string;
    mobileNaverLabel: string;
  };
}
