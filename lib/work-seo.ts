import {
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
} from '../content/works/types';
import {
  SLUG_CAR_MAKER_TERMS,
  SLUG_CAR_MODEL_TERMS,
  SLUG_PART_TERMS,
} from './slug-dictionary';
import { getWorkFilterParts } from './work-parts';

export const categorySeoTerms: Record<WorkCategory, string> = {
  dent: '무도색 덴트 복원',
  'panel-paint': '자동차 판금도색',
  'partial-paint': '범퍼 부분도색',
  'replace-paint': '자동차 교환도색',
  polish: '자동차 광택·외형복원',
};

const categoryTitleTerms: Record<WorkCategory, readonly string[]> = {
  dent: ['덴트', '무도색', 'pdr'],
  'panel-paint': ['판금', '도색', '도장', '페인트'],
  'partial-paint': ['부분도색', '부분도장', '보카시'],
  'replace-paint': ['교환도색', '교환', '교체'],
  polish: ['광택', '폴리싱', '폴리쉬', '흠집제거', '오염제거', '외형복원'],
};

const categoryTitleFallback: Record<WorkCategory, string> = {
  dent: '덴트',
  'panel-paint': '판금도색',
  'partial-paint': '부분도색',
  'replace-paint': '교환도색',
  polish: '광택·복원',
};

const titleSoftLimit = 65;
const descriptionSoftLimit = 180;

function compactSeoText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function cleanInlineText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function includesText(source: string, target: string) {
  const normalizedTarget = compactSeoText(target);
  return Boolean(normalizedTarget) && compactSeoText(source).includes(normalizedTarget);
}

function hasDictionaryMeaning(
  source: string,
  value: string,
  dictionary: Record<string, string>,
) {
  if (includesText(source, value)) return true;

  const normalizedValue = compactSeoText(value);
  const canonical = Object.entries(dictionary).find(
    ([term]) => compactSeoText(term) === normalizedValue,
  )?.[1];
  if (!canonical) return false;

  if (includesText(source, canonical)) return true;
  return Object.entries(dictionary).some(
    ([term, mapped]) => mapped === canonical && includesText(source, term),
  );
}

function hasPartMeaning(source: string, part: string) {
  if (includesText(source, part)) return true;

  const normalizedPart = compactSeoText(part);
  const canonical = Object.entries(SLUG_PART_TERMS).find(
    ([term]) => compactSeoText(term) === normalizedPart,
  )?.[1];
  if (!canonical) return false;

  return Object.entries(SLUG_PART_TERMS).some(([term, mapped]) => {
    const samePartFamily =
      mapped === canonical ||
      mapped.endsWith(`-${canonical}`) ||
      canonical.endsWith(`-${mapped}`);
    return samePartFamily && includesText(source, term);
  });
}

function hasCategoryMeaning(source: string, category: WorkCategory) {
  return categoryTitleTerms[category].some((term) => includesText(source, term));
}

function getMissingCarTerms(source: string, work: WorkItem) {
  const terms: string[] = [];
  if (
    work.carMaker &&
    !hasDictionaryMeaning(source, work.carMaker, SLUG_CAR_MAKER_TERMS)
  ) {
    terms.push(work.carMaker);
  }
  if (
    work.carModel &&
    !hasDictionaryMeaning(source, work.carModel, SLUG_CAR_MODEL_TERMS)
  ) {
    terms.push(work.carModel);
  }
  return terms;
}

function withSentenceEnding(value: string) {
  const cleaned = cleanInlineText(value);
  if (!cleaned || /[.!?。！？]$/u.test(cleaned)) return cleaned;
  return `${cleaned}.`;
}

function uniqueValues(values: readonly string[]) {
  return [...new Set(values.map(cleanInlineText).filter(Boolean))];
}

export function getWorksSeoCopy(category?: WorkCategory) {
  const categoryLabel = category ? getWorkCategoryLabel(category) : '';
  return {
    title: category
      ? `동대문 ${categorySeoTerms[category]} 실제 전후 수리사례 모음 | 에이스덴트`
      : '동대문 판금도색·덴트·부분도색 수리사례 모음 | 에이스덴트',
    description: category
      ? `서울 동대문 에이스덴트가 직접 작업한 ${categoryLabel} 전후 사례입니다. 차종과 손상 부위별 사진, 작업 방법과 결과를 비교하고 내 차량과 비슷한 수리 사례를 확인하세요.`
      : '서울 동대문 에이스덴트의 실제 판금도색·외형복원·무도색 덴트·부분도색 사례 8건입니다. 차종과 손상 부위별 전후 사진, 작업 방식과 수리 내용을 한눈에 확인하세요.',
  };
}

export function getWorkSeoCopy(work: WorkItem) {
  const workTitle = cleanInlineText(work.title);
  const titleParts: string[] = [];

  if (!includesText(workTitle, '동대문')) titleParts.push('동대문');
  titleParts.push(...getMissingCarTerms(workTitle, work));

  const primaryPart = work.part[0] ?? getWorkFilterParts(work)[0];
  if (primaryPart && !hasPartMeaning(workTitle, primaryPart)) {
    titleParts.push(primaryPart);
  }

  titleParts.push(workTitle);
  if (!hasCategoryMeaning(workTitle, work.category)) {
    titleParts.push(categoryTitleFallback[work.category]);
  }
  if (!includesText(workTitle, '사례')) titleParts.push('수리사례');

  const titleCore = titleParts.filter(Boolean).join(' ');
  const title = includesText(titleCore, '에이스덴트')
    ? titleCore
    : `${titleCore} | 에이스덴트`;

  const descriptionCar = getMissingCarTerms(workTitle, work).join(' ');
  const summary = cleanInlineText(work.summary ?? '');
  const descriptionParts = [
    `서울 동대문 에이스덴트의 ${descriptionCar ? `${descriptionCar} ` : ''}${workTitle} 사례입니다.`,
  ];
  if (summary) descriptionParts.push(withSentenceEnding(summary));

  const coveredText = `${workTitle} ${summary}`;
  const actualParts = uniqueValues(getWorkFilterParts(work));
  const missingParts = actualParts.filter((part) => !hasPartMeaning(coveredText, part));
  if (missingParts.length > 0) {
    descriptionParts.push(`전후 사진에는 ${missingParts.join('·')} 부위도 포함됩니다.`);
  }

  const missingSubParts = uniqueValues(work.subParts).filter(
    (part) => !hasPartMeaning(coveredText, part) && !actualParts.includes(part),
  );
  if (missingSubParts.length > 0) {
    descriptionParts.push(`관련 부위는 ${missingSubParts.join('·')}입니다.`);
  }

  if (!hasCategoryMeaning(coveredText, work.category)) {
    descriptionParts.push(`주 작업은 ${getWorkCategoryLabel(work.category)}입니다.`);
  }
  const missingSubCategories = work.subCategories.filter(
    (category) => !hasCategoryMeaning(coveredText, category),
  );
  if (missingSubCategories.length > 0) {
    descriptionParts.push(
      `함께 등록된 작업은 ${missingSubCategories.map(getWorkCategoryLabel).join('·')}입니다.`,
    );
  }

  if (!summary && descriptionParts.length === 1) {
    descriptionParts.push('작업 전후 사진과 부위별 설명을 확인할 수 있습니다.');
  }

  return {
    title,
    description: descriptionParts.join(' '),
  };
}

export function getWorkSeoWarnings(work: WorkItem, existingWorks: readonly WorkItem[]) {
  const seo = getWorkSeoCopy(work);
  const warnings: string[] = [];
  const duplicate = existingWorks.find(
    (candidate) =>
      candidate.slug !== work.slug && getWorkSeoCopy(candidate).title === seo.title,
  );

  if (duplicate) {
    warnings.push(`다른 사례와 자동 제목이 같습니다: ${duplicate.title}`);
  }
  if (seo.title.length > titleSoftLimit) {
    warnings.push('자동 제목이 길어 검색 결과에서 일부 생략될 수 있습니다.');
  }
  if (seo.description.length > descriptionSoftLimit) {
    warnings.push('자동 설명이 길어 검색 결과에서 일부 생략될 수 있습니다.');
  }

  return warnings;
}
