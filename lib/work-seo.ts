import {
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
  type WorkPart,
} from '../content/works/types';
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

export interface WorkCategoryGuide {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
}

const workCategoryGuides: Record<WorkCategory | 'all', WorkCategoryGuide> = {
  all: {
    eyebrow: 'REPAIR GUIDE',
    title: '내 차와 비슷한 수리사례는 어떻게 찾나요?',
    paragraphs: [
      '예를 들어 범퍼 모서리를 긁었다면 부위에서 ‘범퍼’를 골라보세요. 수리 방법을 몰라도 사진에서 긁힌 위치와 모양이 비슷한 사례를 찾을 수 있습니다.',
      '사례를 열면 같은 부위의 수리 전후 사진과 작업 설명을 함께 볼 수 있습니다. 도장이 얼마나 벗겨졌는지, 어느 범위까지 손봤는지 내 차와 비교해 보세요.',
    ],
  },
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
    title: '차체가 찌그러지고 칠도 벗겨졌다면 어떻게 고치나요?',
    paragraphs: [
      '도어나 휀더, 트렁크 덮개처럼 금속으로 된 부위가 눌렸다면 기존 부품을 살릴 수 있는지 먼저 봅니다. 눌린 곳을 펴서 원래 모양에 가깝게 잡고 차 색에 맞춰 다시 칠하는 작업이 판금도색입니다.',
      '펴야 할 곳과 칠해야 할 곳의 넓이는 다를 수 있습니다. 작은 찌그러짐도 주변 색과 자연스럽게 이어지도록 더 넓게 칠할 수 있고, 날카롭게 접힌 곳은 펴고 나서도 흔적이 남을 수 있습니다.',
    ],
  },
  'partial-paint': {
    eyebrow: 'PARTIAL PAINT GUIDE',
    title: '범퍼 모서리만 긁혔는데, 범퍼 전체를 칠해야 하나요?',
    paragraphs: [
      '주차하다 범퍼 모서리를 벽에 긁어 칠이 좁게 벗겨졌다면 부분도색을 검토합니다. 긁힌 면을 매끈하게 다듬은 뒤, 주변 색과 자연스럽게 이어지도록 칠합니다.',
      '돌에 콕 찍힌 자리에만 색을 채우는 터치업보다 넓게 손보는 방법입니다. 같은 크기의 흠집도 위치와 기존 도장 상태에 따라 새로 칠한 경계가 보일 수 있어, 어디까지 칠할지는 차를 보고 정합니다.',
    ],
  },
  'replace-paint': {
    eyebrow: 'REPLACEMENT GUIDE',
    title: '도어나 범퍼는 언제 수리하고, 언제 교환하나요?',
    paragraphs: [
      '도어는 안쪽 구조가 온전하면 눌린 겉철판을 펴고 다시 칠해 살릴 수 있습니다. 가장자리가 심하게 접혀 문을 닫았을 때 틈이 맞지 않거나 안쪽 보강재까지 손상됐다면 차종별 수리 기준에 따라 교환을 검토합니다.',
      '범퍼 모서리가 벌어졌다면 어디가 깨졌는지 먼저 봅니다. 고정 클립만 부러졌다면 클립을 바꿔 기존 범퍼 커버를 다시 고정할 수 있습니다. 커버의 고정 구멍까지 찢어졌거나 모서리 일부가 떨어져 나가 단단히 고정하기 어렵다면 커버 교환을 검토합니다.',
      '교환도색은 손상된 부품을 바꾸고 차 색에 맞춰 칠하는 작업입니다. 수리와 교환이 모두 가능하면 기존 부품을 살리는 비용과 부품값·도색·장착을 포함한 교환 비용을 비교해 안내합니다.',
    ],
  },
  polish: {
    eyebrow: 'SCRATCH REMOVAL GUIDE',
    title: '문에 다른 차 페인트가 묻었는데, 다시 칠해야 하나요?',
    paragraphs: [
      '스친 자리에 다른 색이 보인다면 내 차의 칠이 벗겨진 흔적인지, 상대 차의 페인트가 겉에 묻은 흔적인지 먼저 봅니다. 겉에 묻은 페인트나 타르는 그 부위만 닦아내고, 얕은 흠집은 표면을 가볍게 다듬어 덜 보이게 할 수 있습니다.',
      '오염을 지운 뒤에도 자국이 남을 수 있습니다. 특히 내 차의 칠까지 벗겨졌다면 문질러도 원래 색이 돌아오지 않아, 벗겨진 범위에 따라 터치업이나 도색을 검토합니다.',
    ],
  },
  'touch-up': {
    eyebrow: 'TOUCH-UP GUIDE',
    title: '돌에 맞아 칠이 콕 벗겨진 곳도 손볼 수 있나요?',
    paragraphs: [
      '터치업은 돌에 맞아 칠이 점처럼 벗겨진 자리에 차 색을 조금 채워 덜 눈에 띄게 하는 방법입니다. 예전에 붓으로 덧칠한 곳이 도드라져 보인다면 상태에 따라 다듬을 수도 있습니다.',
      '가까이 보면 색 차이나 붓자국이 남을 수 있습니다. 길게 긁힌 자국을 주변과 고르게 이어지도록 손보고 싶다면 부분도색이 가능한지 살펴봅니다.',
    ],
  },
  'full-polish': {
    eyebrow: 'FULL POLISH GUIDE',
    title: '세차를 해도 차 전체가 뿌옇고 잔흠집이 보이나요?',
    paragraphs: [
      '햇빛 아래서 보닛과 문 곳곳에 가는 흠집이 보이고 차 색도 예전보다 흐려 보인다면 전체 광택을 고려할 수 있습니다. 도장 표면을 차 전체에 걸쳐 다듬어 잔흠집을 줄이고 윤기를 되살리는 작업입니다.',
      '도장이 얇아진 곳은 무리해서 깎지 않으며 깊은 흠집은 남을 수 있습니다. 다른 곳은 깨끗하고 문 한 곳에만 스친 자국이 있다면, 그 부위만 손보는 흠집·오염제거가 가능한지 먼저 봅니다.',
    ],
  },
  coating: {
    eyebrow: 'COATING GUIDE',
    title: '유리막 코팅을 하면 기존 흠집도 없어지나요?',
    paragraphs: [
      '이미 생긴 흠집은 코팅만으로 지워지지 않습니다. 유리막 코팅은 깨끗하게 정리한 도장면에 보호층을 더합니다. 물방울이 맺혀 흘러내리기 쉬워지고(발수), 오염이 덜 달라붙어 세차할 때 닦아내기 수월해집니다(방오).',
      '보통은 광택으로 잔흠집을 다듬고 도장면을 정리한 뒤 유리막 코팅을 합니다. 다만 신차는 도장 상태를 확인해 표면이 깨끗하고 잔흠집이 없으면 광택 없이 바로 코팅할 수 있습니다.',
    ],
  },
};

export function getWorkCategoryGuide(category?: WorkCategory, part?: WorkPart) {
  // 부분도색·전체광택은 부위별 목록에서도 해당 작업 안내를 제공합니다.
  if (part && category !== 'partial-paint' && category !== 'full-polish') return undefined;
  return workCategoryGuides[category ?? 'all'];
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
