import {
  getWorkCategoryLabel,
  type WorkCategory,
  type WorkItem,
} from '../content/works/types';

export const categorySeoTerms: Record<WorkCategory, string> = {
  dent: '무도색 덴트 복원',
  'panel-paint': '자동차 판금도색',
  'partial-paint': '범퍼 부분도색',
  'replace-paint': '자동차 교환도색',
  polish: '자동차 광택·외형복원',
};

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
  const car = [work.carMaker, work.carModel].filter(Boolean).join(' ');
  return {
    title: `동대문 ${categorySeoTerms[work.category]} ${car} ${work.part.join('·')} 수리사례 | 에이스덴트`,
    description: `서울 동대문 에이스덴트의 ${car} ${work.part.join('·')} ${getWorkCategoryLabel(work.category)} 사례입니다. ${work.summary} 전후 사진과 작업 설명, 관련 사례를 함께 확인하세요.`,
  };
}
