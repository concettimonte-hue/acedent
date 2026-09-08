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
] as const;

export type WorkPart = (typeof WORK_PARTS)[number];

export interface WorkPartMedia {
  label: string;
  before: string;
  after: string;
  note: string;
}

export interface WorkItem {
  slug: string;
  date: string;
  title: string;
  category: WorkCategory;
  part: WorkPart[];
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

export function getWorkCategoryLabel(category: WorkCategory) {
  return WORK_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}
