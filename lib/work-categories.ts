import {
  WORK_CATEGORIES,
  type WorkCategory,
  type WorkItem,
  type WorkPartValue,
  type WorkPartMedia,
} from '../content/works/types';

function uniqueCategories(categories: readonly (WorkCategory | undefined)[]) {
  return [...new Set(categories.filter((category): category is WorkCategory => Boolean(category)))];
}

/** PART에 명시적으로 저장된 실제 작업만 반환합니다. 대표 작업으로 폴백하지 않습니다. */
export function getExplicitPartCategories(work: WorkItem): WorkCategory[] {
  return uniqueCategories(work.parts.map((part) => part.category));
}

/** 카테고리 목록/필터에서 사례가 노출될 전체 작업 범위입니다. */
export function getWorkFilterCategories(work: WorkItem): WorkCategory[] {
  return uniqueCategories([
    work.category,
    ...getExplicitPartCategories(work),
    ...work.subCategories,
  ]);
}

export function workMatchesCategory(work: WorkItem, category: WorkCategory) {
  return getWorkFilterCategories(work).includes(category);
}

/** 사례가 한 건 이상 있는 카테고리만 공개 목록과 검색 페이지에 노출합니다. */
export function getAvailableWorkCategories(works: readonly WorkItem[]) {
  return WORK_CATEGORIES.filter(({ id }) =>
    works.some((work) => workMatchesCategory(work, id)),
  );
}

/** 상세 상단 분류 표시 순서: 대표 작업 → PART 실제 작업 → 별도 추가 작업. */
export function getWorkDisplayCategories(work: WorkItem): WorkCategory[] {
  return getWorkFilterCategories(work);
}

/**
 * 선택한 카테고리와 실제로 연결된 PART 부위만 반환합니다.
 *
 * PART 작업 방식이 명시된 신규 데이터는 그 값을 우선하고, 작업 방식이 없는
 * 기존 PART만 사례 대표 작업으로 폴백합니다. subCategories는 사례 전체의 추가
 * 작업이므로 PART 작업 방식이 따로 저장되지 않은 상태에서 특정 부위와 결합하지
 * 않습니다.
 */
export function getWorkPartsForCategory(
  work: WorkItem,
  category?: WorkCategory,
): WorkPartValue[] {
  const parts = category
    ? work.parts.filter((part) =>
      part.category === category ||
      (!part.category && work.category === category),
    )
    : work.parts;

  return [...new Set(parts.flatMap((part) => part.part ?? []).filter(Boolean))];
}

/** 현재 카테고리와 명시적으로 일치하는 PART가 있을 때만 해당 사진을 대표로 선택합니다. */
export function getWorkRepresentativePart(
  work: WorkItem,
  category?: WorkCategory,
  part?: WorkPartValue,
): WorkPartMedia {
  if (category && part) {
    const matched = work.parts.find(
      (candidate) =>
        candidate.category === category && candidate.part?.includes(part),
    );
    if (matched) return matched;

    if (work.category === category) {
      const legacyMatched = work.parts.find(
        (candidate) =>
          !candidate.category && candidate.part?.includes(part),
      );
      if (legacyMatched) return legacyMatched;
    }
  }
  if (part && !category) {
    const matched = work.parts.find((candidate) =>
      candidate.part?.includes(part),
    );
    if (matched) return matched;
  }
  if (category) {
    const matched = work.parts.find((part) => part.category === category);
    if (matched) return matched;

    if (work.category === category) {
      const legacyMatched = work.parts.find((part) => !part.category);
      if (legacyMatched) return legacyMatched;
    }
  }
  return work.parts[0];
}
