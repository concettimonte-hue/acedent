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

export interface WorkPartMedia {
  part?: WorkPartValue[];
  label: string;
  before: string;
  after: string;
  thumbnail?: string;
  note: string;
}

export interface WorkItem {
  slug: string;
  date: string;
  title: string;
  category: WorkCategory;
  subCategories: WorkCategory[];
  part: WorkPartValue[];
  subParts: WorkPartValue[];
  carMaker: string;
  carModel: string;
  color?: string;
  parts: WorkPartMedia[];
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
