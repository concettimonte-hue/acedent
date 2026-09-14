import type {
  WorkCategory,
  WorkItem,
  WorkPartMedia,
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

/** 상세 상단 분류 표시 순서: 대표 작업 → PART 실제 작업 → 별도 추가 작업. */
export function getWorkDisplayCategories(work: WorkItem): WorkCategory[] {
  return getWorkFilterCategories(work);
}

/** 현재 카테고리와 명시적으로 일치하는 PART가 있을 때만 해당 사진을 대표로 선택합니다. */
export function getWorkRepresentativePart(
  work: WorkItem,
  category?: WorkCategory,
): WorkPartMedia {
  if (category) {
    const matched = work.parts.find((part) => part.category === category);
    if (matched) return matched;
  }
  return work.parts[0];
}
