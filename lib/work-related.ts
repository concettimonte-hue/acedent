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
  matchedPartIndex?: number;
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
  positionMatch?: boolean;
}

function getRelatedPartPairs(work: WorkItem) {
  return work.parts.flatMap((mediaPart, index) => {
    const isSingleLegacyPart = work.parts.length === 1;
    const category = mediaPart.category ?? (
      isSingleLegacyPart ? work.category : undefined
    );
    const parts = mediaPart.part?.length
      ? mediaPart.part
      : isSingleLegacyPart
        ? work.part
        : [];

    if (!category) return [];
    return parts.map((part) => ({ part, category, position: mediaPart.position, index }));
  });
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
  // "같은 부위 · 같은 작업"으로 취급하지 않습니다. 다만 PART가 하나뿐인
  // 기존 사례는 사례 대표 부위·작업 외에 연결할 대상이 없으므로 호환합니다.
  const candidatePartPairs = getRelatedPartPairs(candidate);
  const exactPartMatch = getRelatedPartPairs(source).flatMap((sourcePair) =>
    candidatePartPairs.filter((candidatePair) => candidatePair.part === sourcePair.part && candidatePair.category === sourcePair.category)
      .map((candidatePair) => ({ ...candidatePair, positionMatch: Boolean(sourcePair.position && sourcePair.position === candidatePair.position) })),
  ).sort((a, b) => Number(b.positionMatch) - Number(a.positionMatch))[0];

  if (exactPartMatch) {
    return {
      reasons: ['part', 'category'],
      matchedCategory: exactPartMatch.category,
      matchedPart: exactPartMatch.part,
      matchedPartIndex: exactPartMatch.index,
      positionMatch: exactPartMatch.positionMatch,
      score: 8,
    };
  }

  // 정확한 PART 조합이 없으면 사진과 안내 문구가 서로 어긋나지 않도록
  // 부위 일치를 작업 일치보다 우선해 하나의 기준만 사용합니다.
  if (samePart) {
    const primaryPart = source.part[0] ?? sourceParts[0];
    const sourcePositions = new Set(source.parts.filter((part) => part.part?.includes(samePart) && part.position).map((part) => part.position));
    const positionIndex = candidate.parts.findIndex((part) => part.part?.includes(samePart) && part.position && sourcePositions.has(part.position));
    const partIndex = positionIndex >= 0 ? positionIndex : candidate.parts.findIndex((part) => part.part?.includes(samePart));

    return {
      reasons: ['part'],
      matchedPart: samePart,
      matchedPartIndex: partIndex >= 0 ? partIndex : undefined,
      positionMatch: positionIndex >= 0,
      score: samePart === primaryPart ? 4 : 2,
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
      b.score - a.score || Number(Boolean(b.positionMatch)) - Number(Boolean(a.positionMatch)) || a.index - b.index
    ))
    .slice(0, limit)
    .map(({ candidate, reasons, matchedCategory, matchedPart, matchedPartIndex }) => ({
      work: candidate,
      reasons,
      matchedCategory,
      matchedPart,
      matchedPartIndex,
    }));
}
