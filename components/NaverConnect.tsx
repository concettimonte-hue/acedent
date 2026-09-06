'use client';

import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import naverData from '@/content/naver.json';
import type { NaverContent, NaverIconName } from '@/content/types';
import { withLandingUtm } from '@/lib/tracking';

const naver = naverData as NaverContent;

const iconMap: Record<Exclude<NaverIconName, 'naver'>, LucideIcon> = {
  mapPin: MapPin,
  messageCircle: MessageCircle,
  calendarDays: CalendarDays,
};

function NaverLinkIcon({ name }: { name: NaverIconName }) {
  if (name === 'naver')
    return <span className="naver-icon">{naver.section.naverSymbol}</span>;
  const Icon = iconMap[name];
  return <Icon aria-hidden="true" className="card-main-icon" />;
}

export default function NaverConnect() {
  return (
    <section id="naver-connect" className="naver-section">
      <header className="content-section-header dark-header naver-intro">
        <div>
          <p className="section-kicker light">{naver.section.label}</p>
          <h2>{naver.section.title}</h2>
          <p className="content-section-subcopy">{naver.section.description}</p>
        </div>
        <span className="content-section-number">{naver.section.number}</span>
      </header>
      <div className="naver-grid">
        {naver.section.items.map((item) => (
          <a
            href={withLandingUtm(naver[item.key], item.key)}
            target="_blank"
            rel="noopener noreferrer"
            key={item.key}
          >
            <NaverLinkIcon name={item.icon} />
            <div>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
            </div>
            <ArrowUpRight aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
