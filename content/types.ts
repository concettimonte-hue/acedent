export type ServiceIconName = 'carFront' | 'wrench' | 'sparkles' | 'shieldCheck';
export type NaverIconName = 'naver' | 'mapPin' | 'messageCircle' | 'calendarDays';

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
    titleLines: [string, string];
    descriptionLines: string[];
    phoneActionLabel: string;
    smsActionLabel: string;
    casesActionLabel: string;
    resultAriaLabel: string;
    resultKicker: string;
    resultNumber: string;
    imageSrc: string;
    imageAlt: string;
    workLabel: string;
    workValue: string;
    resultLabel: string;
    resultValue: string;
  };
  stats: {
    ariaLabel: string;
    items: Array<{ value: string; label: string }>;
  };
  services: {
    kicker: string;
    titleLines: [string, string];
    description: string;
    items: Array<{ number: string; title: string; copy: string; icon: ServiceIconName }>;
  };
  cases: {
    kicker: string;
    titleLines: [string, string];
    moreLabel: string;
    moreHref: string;
    detailLabel: string;
    ariaSuffix: string;
    badgePrefix: string;
    items: Array<{
      index: string;
      vehicle: string;
      work: string;
      src: string;
      alt: string;
      href: string;
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
