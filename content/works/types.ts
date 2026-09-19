import type { BeforeAfterMode } from '../types';

export const WORK_CATEGORIES = [
  { id: 'dent', label: '덴트(무도색)' },
  { id: 'panel-paint', label: '판금도색' },
  { id: 'partial-paint', label: '부분도색' },
  { id: 'replace-paint', label: '교환도색' },
  { id: 'polish', label: '광택·복원' },
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number]['id'];

export const WORK_PARTS = [
  '범퍼',
  '도어',
  '휀더',
  '후드',
  '트렁크',
  '사이드미러',
  '필러',
  '루프',
  '휠',
  '사이드스텝',
] as const;

export type WorkPart = (typeof WORK_PARTS)[number];

export const WORK_PART_FILTER_ORDER = [
  '범퍼',
  '도어',
  '휀더',
  '트렁크',
  '사이드스텝',
  '후드',
  '루프',
  '필러',
  '사이드미러',
  '휠',
] as const satisfies readonly WorkPart[];

export type WorkPartValue = WorkPart | (string & {});

export const WORK_GALLERY_MAX_PER_SCOPE = 6;
export const WORK_GALLERY_MAX_TOTAL = 12;

export type WorkAssetKind =
  | 'before'
  | 'after'
  | 'thumbnail'
  | 'gallery'
  | 'gallery-thumbnail'
  | 'og-image';

export interface WorkGalleryImage {
  src: string;
  thumbnail?: string;
  caption?: string;
  width: number;
  height: number;
}

export interface WorkPartMedia {
  /** 이 사진 묶음에서 실제로 작업한 부위. 1~3개이며 /works 필터에 사용합니다. */
  part?: WorkPartValue[];
  /** 이 사진 묶음에 실제로 적용한 작업 방식. 기존 데이터는 값이 없을 수 있습니다. */
  category?: WorkCategory;
  label: string;
  before: string;
  after: string;
  thumbnail?: string;
  /** 이 PART의 다른 각도·작업 과정·마감 사진입니다. 전후 비교와 필터에는 관여하지 않습니다. */
  gallery?: WorkGalleryImage[];
  note: string;
}

export interface WorkItem {
  slug: string;
  date: string;
  title: string;
  category: WorkCategory;
  subCategories: WorkCategory[];
  /** 첫 번째 값만 주 부위로 사용하며 slug와 카드의 기준이 됩니다. */
  part: WorkPartValue[];
  /** 상세 표시와 검색에만 사용하는 보조 태그입니다. */
  subParts: WorkPartValue[];
  carMaker: string;
  carModel: string;
  color?: string;
  parts: WorkPartMedia[];
  /** 공유 카드용 1200×630 BEFORE/AFTER 합성 이미지. 기존 사례는 첫 AFTER로 폴백합니다. */
  ogImage?: string;
  /** 특정 PART에 속하지 않는 차량 전경·출고 등 사례 전체 추가 사진입니다. */
  gallery?: WorkGalleryImage[];
  summary: string;
  body: string;
  blogUrl?: string;
  featured: boolean;
  featuredOrder?: number;
  days: string;
  sliderType: BeforeAfterMode;
}

export function isWorkCategory(value: string): value is WorkCategory {
  return WORK_CATEGORIES.some((category) => category.id === value);
}

export function isWorkPart(value: string): value is WorkPart {
  return (WORK_PARTS as readonly string[]).includes(value);
}

export function isWorkPartValue(value: string): value is WorkPartValue {
  const normalized = value.trim();
  return Boolean(normalized) && normalized.length <= 30 && !/[<>\u0000-\u001f]/u.test(normalized);
}

export function getWorkCategoryLabel(category: WorkCategory) {
  return WORK_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}
