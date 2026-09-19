import {
  WORK_CATEGORIES,
  WORK_PARTS,
  type WorkCategory,
  type WorkItem,
  type WorkPart,
} from '../content/works/types';
import { getWorkPartsForCategory } from './work-categories';

export const WORK_PART_LANDING_MIN_COUNT = 3;

export const WORK_PART_ROUTE_SLUGS: Record<WorkPart, string> = {
  범퍼: 'bumper',
  도어: 'door',
  휀더: 'fender',
  후드: 'hood',
  트렁크: 'trunk',
  사이드미러: 'side-mirror',
  필러: 'pillar',
  루프: 'roof',
  휠: 'wheel',
  사이드스텝: 'side-step',
  '차량 전체': 'full-body',
};

export interface WorkPartLanding {
  category: WorkCategory;
  part: WorkPart;
  slug: string;
  path: string;
  works: WorkItem[];
}

export function getWorkPartFromRouteSlug(value: string) {
  return WORK_PARTS.find((part) => WORK_PART_ROUTE_SLUGS[part] === value);
}

export function getWorkPartLandingPath(category: WorkCategory, part: WorkPart) {
  return `/works/${category}/${WORK_PART_ROUTE_SLUGS[part]}`;
}

export function getWorkPartLandingWorks(
  works: readonly WorkItem[],
  category: WorkCategory,
  part: WorkPart,
) {
  return works.filter((work) =>
    getWorkPartsForCategory(work, category).includes(part),
  );
}

export function hasWorkPartLanding(
  works: readonly WorkItem[],
  category: WorkCategory,
  part: WorkPart,
) {
  return getWorkPartLandingWorks(works, category, part).length >= WORK_PART_LANDING_MIN_COUNT;
}

export function getWorkPartLandings(works: readonly WorkItem[]) {
  const landings: WorkPartLanding[] = [];

  for (const { id: category } of WORK_CATEGORIES) {
    for (const part of WORK_PARTS) {
      const matchedWorks = getWorkPartLandingWorks(works, category, part);
      if (matchedWorks.length < WORK_PART_LANDING_MIN_COUNT) continue;
      landings.push({
        category,
        part,
        slug: WORK_PART_ROUTE_SLUGS[part],
        path: getWorkPartLandingPath(category, part),
        works: matchedWorks,
      });
    }
  }

  return landings;
}
