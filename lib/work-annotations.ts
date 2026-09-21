import type { WorkImageAnnotation } from '../content/works/types';

export const WORK_IMAGE_ANNOTATION_MAX = 3;

function coordinate(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`${label} 좌표가 올바르지 않습니다.`);
  }
  return Math.round(number * 10_000) / 10_000;
}

export function parseWorkImageAnnotations(
  value: unknown,
  label = '손상 위치 표시',
): WorkImageAnnotation[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > WORK_IMAGE_ANNOTATION_MAX) {
    throw new Error(`${label}는 최대 ${WORK_IMAGE_ANNOTATION_MAX}개까지 사용할 수 있습니다.`);
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${label} ${index + 1}번 정보가 올바르지 않습니다.`);
    }
    const annotation = entry as Record<string, unknown>;
    if (annotation.type === 'circle') {
      const x = coordinate(annotation.x, `${label} ${index + 1}번`);
      const y = coordinate(annotation.y, `${label} ${index + 1}번`);
      const width = coordinate(annotation.width, `${label} ${index + 1}번`);
      const height = coordinate(annotation.height, `${label} ${index + 1}번`);
      if (width < 0.02 || height < 0.02 || x + width > 1.001 || y + height > 1.001) {
        throw new Error(`${label} ${index + 1}번 원의 크기나 위치가 올바르지 않습니다.`);
      }
      return {
        type: 'circle',
        x,
        y,
        width: Math.min(width, Math.round((1 - x) * 10_000) / 10_000),
        height: Math.min(height, Math.round((1 - y) * 10_000) / 10_000),
      };
    }
    if (annotation.type === 'arrow') {
      const startX = coordinate(annotation.startX, `${label} ${index + 1}번`);
      const startY = coordinate(annotation.startY, `${label} ${index + 1}번`);
      const endX = coordinate(annotation.endX, `${label} ${index + 1}번`);
      const endY = coordinate(annotation.endY, `${label} ${index + 1}번`);
      if (Math.hypot(endX - startX, endY - startY) < 0.03) {
        throw new Error(`${label} ${index + 1}번 화살표가 너무 짧습니다.`);
      }
      return { type: 'arrow', startX, startY, endX, endY };
    }
    throw new Error(`${label} ${index + 1}번 종류가 올바르지 않습니다.`);
  });
}
