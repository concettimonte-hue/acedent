import businessData from '../content/business.json';
import faqData from '../content/faq.json';
import naverData from '../content/naver.json';
import type { BusinessContent, FaqContent, NaverContent } from '../content/types';

export const business = businessData as BusinessContent;
export const faq = faqData as FaqContent;
export const naver = naverData as NaverContent;

export const siteUrl = business.url;
export const defaultTitle = '에이스덴트 | 동대문 판금도색·외형복원·덴트';
export const siteDescription =
  '서울 동대문 에이스덴트는 자동차 판금도색·외형복원·덴트·광택을 차량 상태에 맞춰 안내하고 시공합니다. 실제 작업 전후 사례와 수리 과정을 투명하게 공개하며, 불필요한 수리보다 필요한 범위와 한계를 먼저 설명합니다.';
export const ogImageUrl = `${siteUrl}/og-image.jpg`;

export const autoRepairJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AutoRepair',
  name: business.name,
  image: ogImageUrl,
  url: siteUrl,
  telephone: business.telephone,
  address: {
    '@type': 'PostalAddress',
    ...business.address,
  },
  geo: {
    '@type': 'GeoCoordinates',
    ...business.geo,
  },
  openingHoursSpecification: business.openingHoursSpecification.map((hours) => ({
    '@type': 'OpeningHoursSpecification',
    ...hours,
  })),
  areaServed: business.areaServed.map((name) => ({
    '@type': 'AdministrativeArea',
    name,
  })),
  // 공개된 정액 가격표가 없어 임의 금액 대신 실제 상담 방식으로 표시합니다.
  priceRange: business.priceRange,
  sameAs: [naver.blog, naver.place],
};

export const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.items.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

export const serializeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, '\\u003c');
