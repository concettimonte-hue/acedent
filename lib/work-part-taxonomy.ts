import type { WorkItem, WorkPartValue } from '../content/works/types';

export const SPARE_TIRE_COVER = '스페어타이어 커버' as const;

/** Exact synonyms only: a wheel/hubcap is not necessarily a spare-tire cover. */
export function normalizeWorkPartName(value: WorkPartValue): WorkPartValue {
  const compact = value.replace(/\s+/g, '');
  return compact === '스페어타이어커버' || compact === '스페어타이어휠커버'
    ? SPARE_TIRE_COVER
    : value;
}

// Confirmed legacy covers only. Both slug and the original first-PART label must
// match, so another wheel PART or a later repurposed record is never reclassified.
const legacyCovers: Record<string, readonly [string, string]> = {
  'mercedes-benz-g-g450d-side-wheel-panel-paint': ['휠 커버 측면', '스페어타이어 커버 측면'],
  'mercedes-g-g450d-wheel-panel-paint': ['휠 스페어타이어 휠커버', SPARE_TIRE_COVER],
  'mercedes-benz-g-class-g450d-wheel-panel-paint': ['휠 스페어타이어 휠커버', SPARE_TIRE_COVER],
  'mercedes-g63-wheel-cover-paint': ['휠 후면 스페어타이어 휠커버', '스페어타이어 커버 후면'],
  'mercedes-g-dent': ['스페어타이어 휠커버', SPARE_TIRE_COVER],
};

/** Shared read adapter. Never writes D1, changes slugs, or infers work methods. */
export function normalizeWorkPartTaxonomy<T extends WorkItem>(work: T): T {
  const legacy = legacyCovers[work.slug];
  const first = work.parts[0];
  const legacyMatch = Boolean(legacy && first?.label === legacy[0] && first.part?.includes('휠'));
  const names = (values: WorkPartValue[], replaceWheel = false) => [...new Set(values.map(value =>
    replaceWheel && value === '휠' ? SPARE_TIRE_COVER : normalizeWorkPartName(value),
  ))];
  return {
    ...work,
    part: names(work.part, legacyMatch),
    parts: work.parts.map((part, index) => ({
      ...part,
      part: part.part ? names(part.part, legacyMatch && index === 0) : undefined,
      label: legacyMatch && index === 0 ? legacy[1] : part.label,
    })),
  };
}
