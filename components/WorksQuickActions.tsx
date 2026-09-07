'use client';

import { MessageCircle, Phone, Smartphone } from 'lucide-react';
import naverData from '@/content/naver.json';
import siteData from '@/content/site.json';
import type { NaverContent, SiteContent } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const site = siteData as SiteContent;
const naver = naverData as NaverContent;

interface WorksQuickActionsProps {
  compact?: boolean;
}

export default function WorksQuickActions({ compact = false }: WorksQuickActionsProps) {
  return (
    <nav
      className={compact ? 'works-quick-actions is-compact' : 'works-quick-actions'}
      aria-label="수리 상담"
    >
      <a href={site.contact.phoneHref}>
        <Phone aria-hidden="true" />
        <span>전화 문의</span>
      </a>
      <a href={site.contact.smsHref}>
        <Smartphone aria-hidden="true" />
        <span>사진 문자</span>
      </a>
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
