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

interface RelatedWorkMatch extends Omit<RelatedWorkSuggestion, 'work'> {
  score: number;
}

function getRelatedWorkReasons(
  source: WorkItem,
  candidate: WorkItem,
): RelatedWorkMatch {
  const sourceParts = getWorkFilterParts(source);
  const sourceCategories = getWorkFilterCategories(source);
  const candidateParts = new Set(getWorkFilterParts(candidate));
  const candidateCategories = new Set(getWorkFilterCategories(candidate));
  const samePart = sourceParts.find((part) => candidateParts.has(part));
  const sameCategory = sourceCategories.find((category) =>
    candidateCategories.has(category),
  );

  // 부위와 작업이 각각 다른 PART에서 일치하는 교차 판정은
  // "같은 부위 · 같은 작업"으로 취급하지 않습니다.
  const exactPartMatch = source.parts.flatMap((sourcePart) => {
    if (!sourcePart.category) return [];
    return (sourcePart.part ?? []).map((part) => ({
      part,
      category: sourcePart.category!,
    }));
  }).find(({ part, category }) => candidate.parts.some(
    (candidatePart) =>
      candidatePart.category === category &&
      candidatePart.part?.includes(part),
  ));

  if (exactPartMatch) {
    return {
      reasons: ['part', 'category'],
      matchedCategory: exactPartMatch.category,
      matchedPart: exactPartMatch.part,
      score: 8,
    };
  }

  // 정확한 PART 조합이 없으면 사진과 안내 문구가 서로 어긋나지 않도록
  // 부위 일치를 작업 일치보다 우선해 하나의 기준만 사용합니다.
  if (samePart) {
    const sourcePart = source.parts.find((part) =>
      part.part?.includes(samePart),
    );
    const candidateParts = candidate.parts.filter((part) =>
      part.part?.includes(samePart),
    );
    const legacySinglePartCategoryMatch = Boolean(
      sourcePart?.category &&
      candidate.parts.length === 1 &&
      candidateParts.length === 1 &&
      !candidateParts[0].category &&
      candidate.category === sourcePart.category,
    );
    const primaryPart = source.part[0] ?? sourceParts[0];

    return {
      reasons: ['part'],
      matchedPart: samePart,
      score:
        (samePart === primaryPart ? 4 : 2) +
        (legacySinglePartCategoryMatch ? 1 : 0),
    };
  }

  return {
    reasons: sameCategory ? ['category'] : [],
    matchedCategory: sameCategory,
    score: sameCategory ? 1 : 0,
  };
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
      b.score - a.score || a.index - b.index
    ))
    .slice(0, limit)
    .map(({ candidate, reasons, matchedCategory, matchedPart }) => ({
      work: candidate,
      reasons,
      matchedCategory,
      matchedPart,
    }));
}
