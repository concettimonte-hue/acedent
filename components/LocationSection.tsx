'use client';

import { ArrowUpRight, MapPin, Phone } from 'lucide-react';
import SectionNumber from '@/components/SectionNumber';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type { NaverContent, SiteContent } from '@/content/types';
import { trackTelClick } from '@/lib/analytics';
import { withLandingUtm } from '@/lib/tracking';

const naver = naverData as NaverContent;
const site = siteData as SiteContent;

export default function LocationSection() {
  const { contact } = site;
  const placeUrl = withLandingUtm(naver.place, 'place');

  return (
    <section
      id="location"
      className="section content-section location-section numbered-section"
    >
      <header className="content-section-header">
        <div>
          <p className="section-kicker">{contact.locationSectionLabel}</p>
          <h2>{contact.locationHeading}</h2>
        </div>
        <SectionNumber sectionId="location" />
      </header>

      <div className="location-grid">
        <div className="location-photo">
          <img
            src="/storefront.jpg"
            alt="서울 동대문 판금도색 외형복원 전문 에이스덴트 매장 외관"
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="location-info">
          <div>
            <MapPin aria-hidden="true" />
            <span>
              주소<strong>{contact.footerAddress}</strong>
            </span>
          </div>
          <div>
            <Phone aria-hidden="true" />
            <span>
              전화
              <a
                href={contact.phoneHref}
                onClick={() => trackTelClick('하단')}
              >
                {contact.phoneDisplay}
              </a>
            </span>
          </div>
          <a
            className="primary-action"
            href={placeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {contact.directionsLabel} <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="nearby-copy">
        <strong>{contact.nearbyIntro}</strong>
        <span>{contact.nearbyAreas}</span>
      </div>
    </section>
  );
}
