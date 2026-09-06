'use client';

import { ArrowUpRight, MapPin, Phone } from 'lucide-react';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type { NaverContent, SiteContent } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const naver = naverData as NaverContent;
const site = siteData as SiteContent;

export default function LocationSection() {
  const { contact } = site;
  const placeUrl = withLandingUtm(naver.place, 'place');

  return (
    <section id="location" className="section content-section location-section">
      <header className="content-section-header">
        <div>
          <p className="section-kicker">{contact.locationSectionLabel}</p>
          <h2>{contact.locationHeading}</h2>
        </div>
        <span className="content-section-number">08</span>
      </header>

      <div className="location-grid">
        <div className="location-map">
          <iframe
            src={placeUrl}
            title="에이스덴트 네이버 지도"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
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
              전화<a href={contact.phoneHref}>{contact.phoneDisplay}</a>
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
