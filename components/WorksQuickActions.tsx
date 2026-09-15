'use client';

import { MessageCircle, Phone, Smartphone } from 'lucide-react';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type { NaverContent, SiteContent } from '@/content/types';
import { trackSmsClick, trackTelClick } from '@/lib/analytics';
import { withLandingUtm } from '@/lib/tracking';

const site = siteData as SiteContent;
const naver = naverData as NaverContent;

interface WorksQuickActionsProps {
  compact?: boolean;
  photoPrimary?: boolean;
}

export default function WorksQuickActions({
  compact = false,
  photoPrimary = false,
}: WorksQuickActionsProps) {
  const phoneAction = (
    <a
      href={site.contact.phoneHref}
      onClick={() => trackTelClick(compact ? '플로팅' : '하단')}
    >
      <Phone aria-hidden="true" />
      <span>전화 문의</span>
    </a>
  );
  const photoAction = (
    <a href={site.contact.smsHref} onClick={trackSmsClick}>
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
      >
        <MessageCircle aria-hidden="true" />
        <span>네이버 톡톡</span>
      </a>
    </nav>
  );
}
