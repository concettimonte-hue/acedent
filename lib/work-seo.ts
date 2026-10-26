import {
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
  type WorkPart,
} from '../content/works/types';
import polishData from '../content/polish.json';
import type { PolishContent } from '../content/types';
import {
  SLUG_CAR_MAKER_TERMS,
  SLUG_CAR_MODEL_TERMS,
  SLUG_PART_TERMS,
} from './slug-dictionary';
import { getWorkFilterParts } from './work-parts';
import { getExplicitPartCategories } from './work-categories';
import { getPartImageDescription } from './work-images';

export const categorySeoTerms: Record<WorkCategory, string> = {
  dent: '무도색 덴트 복원',
  'panel-paint': '자동차 판금도색',
  'partial-paint': '범퍼 부분도색',
  'replace-paint': '자동차 교환도색',
  polish: '자동차 흠집·오염 제거',
  'touch-up': '자동차 터치업 보수',
  'full-polish': '자동차 전체 광택',
  coating: '자동차 유리막 코팅',
};

const categoryTitleTerms: Record<WorkCategory, readonly string[]> = {
  dent: ['덴트', '무도색', 'pdr'],
  'panel-paint': ['판금', '도색', '도장', '페인트'],
  'partial-paint': ['부분도색', '부분도장', '보카시'],
  'replace-paint': ['교환도색', '교환', '교체'],
  polish: ['흠집제거', '기스제거', '스크래치제거', '오염제거', '이염제거', '폴리싱', '폴리쉬'],
  'touch-up': ['터치업', '붓터치', 'touch-up', 'touchup'],
  'full-polish': ['차량전체광택', '전체광택', '광택', '전체폴리싱'],
  coating: ['유리막', '유리막코팅', '발수코팅', '코팅'],
};

const categoryTitleFallback: Record<WorkCategory, string> = {
  dent: '덴트',
  'panel-paint': '판금도색',
  'partial-paint': '부분도색',
  'replace-paint': '교환도색',
  polish: '흠집·오염제거',
  'touch-up': '터치업 보수',
  'full-polish': '차량 전체 광택',
  coating: '유리막 코팅',
};

const titleSoftLimit = 65;
const descriptionSoftLimit = 180;
const polish = polishData as PolishContent;
const fullPolishService = polish.items.find((item) => item.id === 'fullpolish');

export interface WorkCategoryGuide {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
}

const workCategoryGuides: Partial<Record<WorkCategory, WorkCategoryGuide>> = {
  dent: {
    eyebrow: 'DENT GUIDE',
    title: '문콕·찌그러짐은 덴트로 가능할까요?',
    paragraphs: [
      '덴트는 문콕처럼 도장이 벗겨지지 않은 눌림을 새로 칠하지 않고 펴는 작업입니다. 도장 상태와 손상 위치·깊이, 도구 접근 가능 여부를 확인해 복원 방법을 정합니다.',
      '접근 가능한 부위는 구멍을 뚫지 않는 무천공 방식으로 작업합니다. 다만 심한 찌그러짐이나 날카롭게 꺾인 부분은 흔적이 남을 수 있고, 도장이 손상된 경우에는 도색이 필요할 수 있습니다. 사진만으로 판단하기 어려운 부분은 방문 확인 후 가능한 결과와 작업 범위를 안내합니다.',
    ],
  },
  'panel-paint': {
    eyebrow: 'PANEL PAINT GUIDE',
    title: '판금도색과 교환은 어떻게 판단하나요?',
    paragraphs: [
      '판금도색은 찌그러진 철판을 펴고 그 부분만 색을 다시 칠하는 작업입니다. 비용은 손상 정도와 패널 수에 따라 달라지고 정확한 기간은 차량 상태 확인 후 안내하며, 사진만으로 단정하기 어려운 부분은 방문 확인을 안내합니다.',
      '복원보다 부품 교환이 비용이 적으면 교환을 권하고, 서비스센터가 더 저렴한 경우도 숨기지 않습니다. 색상이 완전히 같을 수 없는 경우나 심한 찌그러짐으로 처음의 예리한 각을 그대로 만들기 어려운 경우처럼, 가능한 결과와 작업의 한계는 작업 전에 설명합니다.',
    ],
  },
  'partial-paint': {
    eyebrow: 'PARTIAL PAINT GUIDE',
    title: '부분도색 사례에서 확인할 점',
    paragraphs: [
      '부분도색은 손상 범위가 국소적인 경우 패널 전체를 넓게 작업하지 않고 손상된 범위를 중심으로 진행하는 방식입니다. 사례 카드에서 작업 전 손상 위치와 작업 후 마감 상태를 차종과 부위별로 비교할 수 있습니다.',
      '적용 가능 여부는 손상 범위와 위치, 기존 도장 상태에 따라 달라집니다. 손상 부위가 잘 보이는 사진을 보내주시면 부분도색으로 가능한지 먼저 확인해 안내합니다.',
    ],
  },
  polish: {
    eyebrow: 'SCRATCH REMOVAL GUIDE',
    title: '흠집·오염은 도색 없이 지울 수 있나요?',
    paragraphs: [
      '얕은 흠집과 페인트 이염은 도장 상태를 확인한 뒤 폴리싱으로 완화하거나 제거할 수 있습니다. 물자국·타르·석회물·본드 같은 오염은 종류와 도장 손상 정도에 맞춰 제거하고, 필요한 부위만 다듬어 기존 도장을 최대한 보존합니다.',
      '깊게 패이거나 칠이 벗겨진 부분은 폴리싱만으로 복원하기 어렵습니다. 상태에 따라 붓터치나 도색을 안내하며, 붓터치 자국과 찌그러짐은 남을 수 있습니다. 오염이 도장면을 파고든 경우도 자국이 남거나 재도장이 필요할 수 있어, 가능한 결과와 한계를 먼저 설명합니다.',
    ],
  },
  'touch-up': {
    eyebrow: 'TOUCH-UP GUIDE',
    title: '터치업 보수는 어떤 작업인가요?',
    paragraphs: [
      '작은 도장 손상에 색을 보충하거나 거칠게 남은 붓터치 자국을 다듬는 작업입니다. 손상과 기존 보수 상태에 따라 터치업, 샌딩, 폴리싱을 조합해 주변 도장면과의 질감과 경계 차이를 줄입니다.',
      '넓은 도장 손상이나 깊은 변형까지 해결하는 방식은 아닙니다. 색 차이나 보수 흔적이 남을 수 있어, 가능한 마감 수준과 도색이 필요한지를 먼저 안내합니다.',
    ],
  },
  'full-polish': {
    eyebrow: 'FULL POLISH GUIDE',
    title: '차량 전체 광택 사례에서 확인할 점',
    paragraphs: [
      [fullPolishService?.desc, fullPolishService?.notWhen].filter(Boolean).join(' '),
      `사례의 작업 전후 사진에서 도장면의 선명도와 광도 변화를 확인하세요. ${polish.closing}`,
    ],
  },
};

export function getWorkCategoryGuide(category?: WorkCategory, part?: WorkPart) {
  // 새 안내는 최상위에 한정하고 기존 부분도색·전체광택의 부위별 노출은 유지합니다.
  if (part && (category === 'dent' || category === 'panel-paint' || category === 'polish' || category === 'touch-up')) return undefined;
  return category ? workCategoryGuides[category] : undefined;
}

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
      : '서울 동대문 에이스덴트의 실제 판금도색·외형복원·무도색 덴트·부분도색 사례입니다. 차종과 손상 부위별 전후 사진, 작업 방식과 수리 내용을 한눈에 확인하세요.',
  };
}

export function getWorkPartLandingSeoCopy(category: WorkCategory, part: string) {
  const categoryLabel = getWorkCategoryLabel(category);
  return {
    title: `동대문 ${part} ${categoryTitleFallback[category]} 실제 수리사례 | 에이스덴트`,
    description: `서울 동대문 에이스덴트가 직접 작업한 ${part} ${categoryLabel} 전후 사례입니다. 차종별 손상 상태와 작업 과정, 복원 결과를 비교하고 내 차량과 비슷한 사례를 확인하세요.`,
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

  const explicitPartWorkFacts = uniqueValues(
    work.parts.flatMap((part) => part.category
      ? [`${getPartImageDescription(part)} ${getWorkCategoryLabel(part.category)}`]
      : []),
  );
  const missingPartWorkFacts = explicitPartWorkFacts.filter(
    (fact) => !includesText(coveredText, fact),
  );
  if (missingPartWorkFacts.length > 0) {
    descriptionParts.push(`부위별 작업은 ${missingPartWorkFacts.join(', ')}입니다.`);
  }

  if (!hasCategoryMeaning(coveredText, work.category)) {
    descriptionParts.push(`주 작업은 ${getWorkCategoryLabel(work.category)}입니다.`);
  }
  const explicitPartCategories = getExplicitPartCategories(work);
  const missingSubCategories = work.subCategories.filter(
    (category) =>
      !explicitPartCategories.includes(category) &&
      !hasCategoryMeaning(coveredText, category),
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
