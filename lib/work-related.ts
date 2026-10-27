import type {
  WorkCategory,
  WorkItem,
  WorkPartPosition,
  WorkPartValue,
} from '../content/works/types';
import { formatWorkPartNames, isPositionableWorkPart } from '../content/works/types';
import { getWorkFilterCategories } from './work-categories';
import { getWorkFilterParts } from './work-parts';

export type RelatedWorkReason = 'part' | 'category';

export interface RelatedWorkSuggestion {
  work: WorkItem;
  reasons: RelatedWorkReason[];
  matchedCategory?: WorkCategory;
  matchedPart?: WorkPartValue;
  matchedPartIndex?: number;
  matchedPosition?: WorkPartPosition;
}

const reasonLabels: Record<RelatedWorkReason, string> = {
  part: '같은 부위',
  category: '같은 작업',
};

export function getRelatedWorkReasonLabel(reason: RelatedWorkReason) {
  return reasonLabels[reason];
}

export function getRelatedWorkReasonLabels(
  suggestion: Pick<RelatedWorkSuggestion, 'reasons' | 'matchedPart' | 'matchedPosition'>,
) {
  return suggestion.reasons.map((reason) => (
    reason === 'part' && suggestion.matchedPart && suggestion.matchedPosition
      ? `같은 ${formatWorkPartNames([suggestion.matchedPart], suggestion.matchedPosition)[0]}`
      : getRelatedWorkReasonLabel(reason)
  ));
}

interface RelatedWorkMatch extends Omit<RelatedWorkSuggestion, 'work'> {
  score: number;
  positionScore: number;
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

    return parts.map((part) => ({
      part, category, index,
      position: isPositionableWorkPart(part) ? mediaPart.position : undefined,
    }));
  });
}

// Only compare positions on the same body part. Unknown is a safer fallback
// than an explicitly opposite position; labels/titles never supply missing data.
function positionScore(source?: WorkPartPosition, candidate?: WorkPartPosition) {
  if (!source || !candidate) return 0;
  return source === candidate ? 1 : -1;
}

function compareMatches(a: RelatedWorkMatch, b: RelatedWorkMatch) {
  return b.score - a.score || b.positionScore - a.positionScore;
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
  const primaryPart = source.part[0] ?? sourceParts[0];
  const candidatePartPairs = getRelatedPartPairs(candidate);
  const matches = getRelatedPartPairs(source).flatMap((sourcePair) =>
    candidatePartPairs.filter((pair) => pair.part === sourcePair.part)
      .map((pair): RelatedWorkMatch => {
        const exact = Boolean(sourcePair.category && sourcePair.category === pair.category);
        const position = positionScore(sourcePair.position, pair.position);
        return {
          reasons: exact ? ['part', 'category'] : ['part'],
          matchedCategory: exact ? pair.category : undefined,
          matchedPart: pair.part,
          matchedPartIndex: pair.index,
          matchedPosition: position === 1 ? pair.position : undefined,
          score: exact ? 8 : pair.part === primaryPart ? 4 : 2,
          positionScore: position,
        };
      }),
  ).sort(compareMatches);

  if (matches[0]) return matches[0];

  // 정확한 PART 조합이 없으면 사진과 안내 문구가 서로 어긋나지 않도록
  // 부위 일치를 작업 일치보다 우선해 하나의 기준만 사용합니다.
  if (samePart) {
    const partIndex = candidate.parts.findIndex((part) => part.part?.includes(samePart));

    return {
      reasons: ['part'],
      matchedPart: samePart,
      matchedPartIndex: partIndex >= 0 ? partIndex : undefined,
      positionScore: 0,
      score: samePart === primaryPart ? 4 : 2,
    };
  }

  return {
    reasons: sameCategory ? ['category'] : [],
    matchedCategory: sameCategory,
    score: sameCategory ? 1 : 0,
    positionScore: 0,
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
      compareMatches(a, b) || a.index - b.index
    ))
    .slice(0, limit)
    .map(({ candidate, reasons, matchedCategory, matchedPart, matchedPartIndex, matchedPosition }) => ({
      work: candidate,
      reasons,
      matchedCategory,
      matchedPart,
      matchedPartIndex,
      matchedPosition,
    }));
}
