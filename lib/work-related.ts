import type {
  WorkCategory,
  WorkItem,
  WorkPartValue,
} from '../content/works/types';
import { getWorkFilterCategories } from './work-categories';
import { getWorkFilterParts } from './work-parts';

export type RelatedWorkReason = 'part' | 'category';

export interface RelatedWorkSuggestion {
  work: WorkItem;
  reasons: RelatedWorkReason[];
  matchedCategory?: WorkCategory;
  matchedPart?: WorkPartValue;
}

const reasonLabels: Record<RelatedWorkReason, string> = {
  part: '같은 부위',
  category: '같은 작업',
};

export function getRelatedWorkReasonLabel(reason: RelatedWorkReason) {
  return reasonLabels[reason];
}

function getRelatedWorkReasons(
  source: WorkItem,
  candidate: WorkItem,
): Omit<RelatedWorkSuggestion, 'work'> {
  const sourceParts = getWorkFilterParts(source);
  const sourceCategories = getWorkFilterCategories(source);
  const candidateParts = new Set(getWorkFilterParts(candidate));
  const candidateCategories = new Set(getWorkFilterCategories(candidate));
  const matchedPart = sourceParts.find((part) => candidateParts.has(part));
  const matchedCategory = sourceCategories.find((category) =>
    candidateCategories.has(category),
  );

  return {
    reasons: [
      ...(matchedPart ? ['part' as const] : []),
      ...(matchedCategory ? ['category' as const] : []),
    ],
    matchedCategory,
    matchedPart,
  };
}

function getReasonScore(reasons: RelatedWorkReason[]) {
  return (
    (reasons.includes('part') ? 2 : 0) +
    (reasons.includes('category') ? 1 : 0)
  );
}

export function selectRelatedWorkSuggestions(
  works: readonly WorkItem[],
  source: WorkItem,
  limit = 3,
): RelatedWorkSuggestion[] {
  return works
    .map((candidate, index) => ({
      candidate,
      index,
      ...getRelatedWorkReasons(source, candidate),
    }))
    .filter(({ candidate, reasons }) => (
      candidate.slug !== source.slug && reasons.length > 0
    ))
    .sort((a, b) => (
      getReasonScore(b.reasons) - getReasonScore(a.reasons) || a.index - b.index
    ))
    .slice(0, limit)
    .map(({ candidate, reasons, matchedCategory, matchedPart }) => ({
      work: candidate,
      reasons,
      matchedCategory,
      matchedPart,
    }));
}
