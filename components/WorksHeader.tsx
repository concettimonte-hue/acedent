'use client';

import { ArrowLeft, Phone } from 'lucide-react';
import siteData from '@/content/site.json';
import type { SiteContent } from '@/content/types';
import { trackTelClick } from '@/lib/analytics';

const site = siteData as SiteContent;

export default function WorksHeader() {
  return (
    <header className="works-header">
      <a className="works-home-link" href="/">
        <ArrowLeft aria-hidden="true" />
        <span>메인으로</span>
      </a>
      <a className="brand works-brand" href="/" aria-label="에이스덴트 홈">
        <span className="brand-logo" aria-hidden="true">
          <img
            src={site.brand.logoSrc}
            alt={site.brand.logoAlt}
            width="1600"
            height="1200"
            loading="eager"
          />
        </span>
        <span>
          <strong>{site.brand.name}</strong>
          <small>REPAIR WORKS</small>
        </span>
      </a>
      <a
        className="header-call"
        href={site.contact.phoneHref}
        onClick={() => trackTelClick('상단')}
      >
        <Phone aria-hidden="true" />
        <span>{site.contact.headerPhoneLabel}</span>
      </a>
    </header>
  );
}
