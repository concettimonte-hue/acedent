'use client';

import { MessageCircle, Phone, Smartphone } from 'lucide-react';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type { NaverContent, SiteContent } from '@/content/types';
import {
  trackSmsClick,
  trackTalkClick,
  trackTelClick,
} from '@/lib/analytics';
import { withLandingUtm } from '@/lib/tracking';

const site = siteData as SiteContent;
const naver = naverData as NaverContent;

interface WorksQuickActionsProps {
  compact?: boolean;
  photoPrimary?: boolean;
  workSlug?: string;
}

export default function WorksQuickActions({
  compact = false,
  photoPrimary = false,
  workSlug,
}: WorksQuickActionsProps) {
  const placement = compact ? 'works_sticky' : 'work_detail_contact';
  const phoneAction = (
    <a
      href={site.contact.phoneHref}
      onClick={() => trackTelClick(placement, workSlug)}
    >
      <Phone aria-hidden="true" />
      <span>전화 문의</span>
    </a>
  );
  const photoAction = (
    <a
      href={site.contact.smsHref}
      onClick={() => trackSmsClick(placement, workSlug)}
    >
      <Smartphone aria-hidden="true" />
      <span>{photoPrimary ? '사진 상담 시작' : '사진 문자'}</span>
    </a>
  );

  return (
    <nav
      className={[
        'works-quick-actions',
        compact ? 'is-compact' : '',
        photoPrimary ? 'is-photo-primary' : '',
      ].filter(Boolean).join(' ')}
      aria-label="수리 상담"
    >
      {photoPrimary ? photoAction : phoneAction}
      {photoPrimary ? phoneAction : photoAction}
      <a
        href={withLandingUtm(naver.talk, 'work_detail')}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackTalkClick(placement, naver.talk, workSlug)}
      >
        <MessageCircle aria-hidden="true" />
        <span>네이버 톡톡</span>
      </a>
    </nav>
  );
}
