import type { WorkItem, WorkPartMedia } from '../content/works/types';
import { getWorkCategoryLabel } from '../content/works/types';

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

export function getWorkPrimaryPart(work: WorkItem) {
  return work.parts[0];
}

export function getWorkPrimaryAfterSrc(work: WorkItem) {
  return resolveWorkImageSrc(getWorkPrimaryPart(work).after);
}

export function getWorkThumbnailSrc(work: WorkItem) {
  const after = getWorkPrimaryPart(work).after;
  const thumbnail = after.replace(
    /^\/works\/(.+)-after\.(?:jpe?g|png|webp)$/i,
    '/works/thumbnails/$1.jpg',
  );
  return resolveWorkImageSrc(thumbnail === after ? after : thumbnail);
}

export function getWorkImageAlt(
  work: WorkItem,
  part: WorkPartMedia,
  state: '전' | '후',
) {
  return `서울 동대문 ${work.carMaker} ${work.carModel} ${part.label} ${getWorkCategoryLabel(work.category)} 작업 ${state}`;
}
