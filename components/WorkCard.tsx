'use client';

import { ArrowUpRight } from 'lucide-react';
import WorkVehicleTag from '@/components/WorkVehicleTag';
import {
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
  type WorkPartValue,
} from '@/content/works/types';
import {
  getWorkImageAlt,
  getWorkThumbnailSrcForCategory,
} from '@/lib/work-images';
import { getWorkRepresentativePart } from '@/lib/work-categories';
import { formatWorkCar } from '@/lib/works';
import { formatWorkCardParts } from '@/lib/work-parts';
import { trackCaseView } from '@/lib/analytics';

interface WorkCardProps {
  work: WorkItem;
  contextCategory?: WorkCategory;
  contextPart?: WorkPartValue;
  reasonLabels?: readonly string[];
}

export default function WorkCard({
  work,
  contextCategory,
  contextPart,
  reasonLabels = [],
}: WorkCardProps) {
  const representativePart = getWorkRepresentativePart(
    work,
    contextCategory,
    contextPart,
  );
  const displayedCategory = contextCategory && representativePart.category === contextCategory
    ? contextCategory
    : work.category;

  return (
    <a
      className="work-card"
      href={`/works/detail/${work.slug}`}
      onClick={() => trackCaseView(work.slug, work.part[0])}
      aria-label={`${formatWorkCar(work)} ${work.title} 상세 보기`}
    >
      <span className="work-card-media">
        <img
          src={getWorkThumbnailSrcForCategory(work, contextCategory, contextPart)}
          alt={getWorkImageAlt(work, representativePart, '후')}
          width="800"
          height="600"
          loading="lazy"
          decoding="async"
        />
        <span className="work-card-category">
          {getWorkCategoryLabel(displayedCategory)}
        </span>
        {reasonLabels.length > 0 && (
          <span className="work-card-reasons">{reasonLabels.join(' · ')}</span>
        )}
      </span>
      <span className="work-card-copy">
        <WorkVehicleTag maker={work.carMaker} model={work.carModel} />
        <strong>{work.title}</strong>
        <span className="work-card-summary">{work.summary}</span>
        <span className="work-card-footer">
          <span className="work-card-parts">{formatWorkCardParts(work)}</span>
          <span className="work-card-open">
            상세 보기 <ArrowUpRight aria-hidden="true" />
          </span>
        </span>
      </span>
    </a>
  );
}
