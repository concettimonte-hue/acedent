'use client';

import { ArrowUpRight } from 'lucide-react';
import { getWorkCategoryLabel, type WorkItem } from '@/content/works/types';
import {
  getWorkImageAlt,
  getWorkPrimaryPart,
  getWorkThumbnailSrc,
} from '@/lib/work-images';
import { formatWorkCar } from '@/lib/works';
import { trackCaseView } from '@/lib/analytics';

interface WorkCardProps {
  work: WorkItem;
}

export default function WorkCard({ work }: WorkCardProps) {
  const primaryPart = getWorkPrimaryPart(work);

  return (
    <a
      className="work-card"
      href={`/works/detail/${work.slug}`}
      onClick={() => trackCaseView(work.slug, work.part[0])}
      aria-label={`${formatWorkCar(work)} ${work.title} 상세 보기`}
    >
      <span className="work-card-media">
        <img
          src={getWorkThumbnailSrc(work)}
          alt={getWorkImageAlt(work, primaryPart, '후')}
          width="800"
          height="600"
          loading="lazy"
          decoding="async"
        />
        <span className="work-card-category">
          {getWorkCategoryLabel(work.category)}
        </span>
      </span>
      <span className="work-card-copy">
        <span className="work-card-car">{formatWorkCar(work)}</span>
        <strong>{work.title}</strong>
        <span className="work-card-summary">{work.summary}</span>
        <span className="work-card-footer">
          <span>{work.part[0]}</span>
          <span className="work-card-open">
            상세 보기 <ArrowUpRight aria-hidden="true" />
          </span>
        </span>
      </span>
    </a>
  );
}
