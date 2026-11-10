'use client';

import { ArrowLeft, Phone } from 'lucide-react';
import siteData from '@/content/site.json';
import type { SiteContent } from '@/content/types';
import { trackTelClick } from '@/lib/analytics';
import HeaderBrand from '@/components/HeaderBrand';

const site = siteData as SiteContent;

export default function WorksHeader() {
  return (
    <header className="works-header">
      <a className="works-home-link" href="/" aria-label="메인으로">
        <ArrowLeft aria-hidden="true" />
        <span>메인으로</span>
      </a>
      <HeaderBrand className="works-brand" />
      <a
        className="header-call"
        href={site.contact.phoneHref}
        aria-label={site.contact.headerPhoneLabel}
        onClick={() => trackTelClick('works_header')}
      >
        <Phone aria-hidden="true" />
        <span>{site.contact.headerPhoneLabel}</span>
      </a>
    </header>
  );
}
