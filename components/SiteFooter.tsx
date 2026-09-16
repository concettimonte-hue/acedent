'use client';

import { ArrowUpRight } from 'lucide-react';
import businessData from '@/content/business.json';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type {
  BusinessContent,
  NaverContent,
  SiteContent,
} from '@/content/types';
import { trackTelClick } from '@/lib/analytics';
import { withLandingUtm } from '@/lib/tracking';

const business = businessData as BusinessContent;
const naver = naverData as NaverContent;
const site = siteData as SiteContent;

const address = [
  business.address.addressRegion,
  business.address.addressLocality,
  business.address.streetAddress,
].join(' ');

export default function SiteFooter() {
  const { brand, contact } = site;
  const placeUrl = withLandingUtm(naver.place, 'place');
  const blogUrl = withLandingUtm(naver.blog, 'blog');

  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-identity">
          <a
            href="/"
            className="brand footer-brand"
            aria-label={brand.homeAriaLabel}
          >
            <span className="brand-logo" aria-hidden="true">
              <img
                src={brand.logoSrc}
                alt=""
                width="1600"
                height="1200"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span>
              <strong>{brand.name}</strong>
              <small>{brand.tagline}</small>
            </span>
          </a>
          <p>서울 동대문 자동차 외장관리 전문점</p>
        </div>

        <nav className="site-footer-links" aria-label="하단 주요 메뉴">
          <p>바로가기</p>
          <div>
            <a href="/">홈</a>
            <a href="/works">수리사례</a>
            <a href="/#principle">작업원칙</a>
            <a href="/#location">오시는 길</a>
            <a href={blogUrl} target="_blank" rel="noopener noreferrer">
              네이버 블로그 <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </nav>

        <div className="site-footer-contact">
          <p>CONTACT</p>
          <address>{address}</address>
          <a href={contact.phoneHref} onClick={() => trackTelClick('하단')}>
            <span>{contact.footerPhonePrefix}</span>
            <strong>{contact.phoneDisplay}</strong>
          </a>
        </div>
      </div>

      <div className="site-footer-bottom">
        <small>© ACE DENT. All rights reserved.</small>
        <a href={placeUrl} target="_blank" rel="noopener noreferrer">
          네이버 지도에서 위치 확인 <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
