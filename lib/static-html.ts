import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import Home from '../app/page';
import WorkDetailPage from '../components/WorkDetailPage';
import WorksGalleryPage from '../components/WorksGalleryPage';
import WorkVehicleTag from '../components/WorkVehicleTag';
import type { WorkCategory, WorkItem, WorkPart } from '../content/works/types';
import type { RelatedWorkSuggestion } from './work-related';
import { getFeaturedWorks, getWorkBySlug } from './works';

export function getStaticWorkVehicleTag(maker: string, model?: string) {
  // Standalone logo previews use the static failure handler without hydration.
  return renderToString(createElement(WorkVehicleTag, { maker, model, showLogo: true }))
    .replace('<img ', '<img data-static-vehicle-brand ');
}

export function getHomeStaticHtml(works?: WorkItem[]) {
  return renderToString(createElement(Home, { featuredWorks: getFeaturedWorks(8, works) }));
}

export function getWorksStaticHtml(
  works?: WorkItem[],
  category?: WorkCategory,
  part?: WorkPart,
  beforeCards?: Readonly<Record<string, string>>,
) {
  return renderToString(createElement(WorksGalleryPage, { works, category, part, beforeCards }));
}

export function getWorkDetailStaticHtml(
  work: WorkItem,
  relatedSuggestions?: RelatedWorkSuggestion[],
  categoryWorkCount?: number,
  allWorks?: WorkItem[],
) {
  return renderToString(createElement(WorkDetailPage, {
    work, relatedSuggestions, categoryWorkCount, allWorks,
  }));
}

export function renderPublishedWorkDetail(slug: string) {
  const work = getWorkBySlug(slug);
  if (!work) throw new Error(`Missing published work: ${slug}`);
  return getWorkDetailStaticHtml(work);
}
