import type { WorkItem } from '@/content/works/types';

export const WORK_IMAGE_DIRECTORY = '/works';

export const WORK_IMAGE_UPLOAD_RULES = {
  maxWidth: 1600,
  maxBytes: 200_000,
  sameAngle: true,
} as const;

export function resolveWorkImageSrc(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export function getWorkThumbnailSrc(work: WorkItem) {
  return resolveWorkImageSrc(work.thumbnail || work.after);
}
