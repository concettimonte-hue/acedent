import {
  WORK_COMPARISON_MAX_PER_PART,
  WORK_COMPARISON_MAX_TOTAL,
} from '../content/works/types';
import type { WorkImageAnnotation } from '../content/works/types';
import { parseWorkImageAnnotations } from './work-annotations';

// Shared by create/update APIs and both page render paths. No category fallback.
export function normalizeComparisons<T>(
  value: unknown,
  readImage: (value: unknown, field: string) => T,
  field = '추가 전후 비교',
): { before: T; after: T; caption?: string; beforeAnnotations?: WorkImageAnnotation[] }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > WORK_COMPARISON_MAX_PER_PART) {
    throw new Error(`${field}는 PART당 최대 ${WORK_COMPARISON_MAX_PER_PART}쌍까지 등록할 수 있습니다.`);
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${field} ${index + 1}번 정보가 올바르지 않습니다.`);
    }
    if (item.caption !== undefined && (typeof item.caption !== 'string' || item.caption.trim().length > 120)) {
      throw new Error(`${field} 설명은 120자 이하여야 합니다.`);
    }
    return {
      before: readImage(item.before, `${field} ${index + 1}번 BEFORE`),
      after: readImage(item.after, `${field} ${index + 1}번 AFTER`),
      caption: item.caption?.trim() || undefined,
      ...(item.beforeAnnotations !== undefined ? {
        beforeAnnotations: parseWorkImageAnnotations(item.beforeAnnotations, `${field} ${index + 1}번 손상 위치 표시`),
      } : {}),
    };
  });
}

export function comparisonAssetReference(value: unknown, field: string): { key: string } {
  const key = value && typeof value === 'object' && 'key' in value ? value.key : undefined;
  if (typeof key !== 'string' || !/^works\/[a-zA-Z0-9/_-]+\.jpg$/.test(key)) {
    throw new Error(`${field} 사진을 선택하세요.`);
  }
  return { key };
}

export function comparisonImageUrl(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim() || !/^(?:https?:\/\/|\/works\/)/i.test(value)) {
    throw new Error(`${field} 이미지 주소가 올바르지 않습니다.`);
  }
  return value.trim();
}

export function validateComparisonTotal(parts: readonly { comparisons?: readonly unknown[] }[]) {
  if (parts.reduce((count, part) => count + (part.comparisons?.length ?? 0), 0) > WORK_COMPARISON_MAX_TOTAL) {
    throw new Error(`추가 전후 비교는 사례 전체 최대 ${WORK_COMPARISON_MAX_TOTAL}쌍까지 등록할 수 있습니다.`);
  }
}
