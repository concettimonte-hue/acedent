import type { WorkItem, WorkPartMedia } from '../content/works/types';
import { SLUG_PART_TERMS } from './slug-dictionary';

export const WORK_IMAGE_DIRECTORY = '/works';

export const WORK_IMAGE_UPLOAD_RULES = {
  maxWidth: 1600,
  maxBytes: 200_000,
  sameAngle: true,
} as const;

function compactImageText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function labelHasPartMeaning(label: string, value: string) {
  const labelCompact = compactImageText(label);
  const valueCompact = compactImageText(value);
  if (valueCompact && labelCompact.includes(valueCompact)) return true;

  const canonical = Object.entries(SLUG_PART_TERMS).find(
    ([term]) => compactImageText(term) === valueCompact,
  )?.[1];
  if (!canonical) return false;

  return Object.entries(SLUG_PART_TERMS).some(([term, mapped]) => {
    const samePartFamily =
      mapped === canonical ||
      mapped.endsWith(`-${canonical}`) ||
      canonical.endsWith(`-${mapped}`);
    return samePartFamily && labelCompact.includes(compactImageText(term));
  });
}

function getPartImageDescription(part: WorkPartMedia) {
  const label = part.label.trim().replace(/\s+/g, ' ');
  const partValues = [...new Set((part.part ?? []).map((value) => value.trim()).filter(Boolean))];
  const partPrefix = partValues.join(' · ');

  if (partPrefix && label.startsWith(partPrefix)) {
    const detail = label.slice(partPrefix.length).trim();
    const repeatedLeadingPart = partValues.find((value) =>
      compactImageText(detail).startsWith(compactImageText(value)),
    );
    const prefixValues = repeatedLeadingPart
      ? partValues.filter((value) => value !== repeatedLeadingPart)
      : partValues;
    return [prefixValues.join(' · '), detail].filter(Boolean).join(' ') || partPrefix;
  }

  const missingPartValues = partValues.filter(
    (value) => !labelHasPartMeaning(label, value),
  );
  return [missingPartValues.join(' · '), label || partPrefix].filter(Boolean).join(' ');
}

export function resolveWorkImageSrc(path: string) {
  if (/^(?:https?:|blob:|data:)/i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export function getWorkPrimaryPart(work: WorkItem) {
  return work.parts[0];
}

export function getWorkPrimaryAfterSrc(work: WorkItem) {
  return resolveWorkImageSrc(getWorkPrimaryPart(work).after);
}

export function getWorkThumbnailSrc(work: WorkItem) {
  const primaryPart = getWorkPrimaryPart(work);
  if (primaryPart.thumbnail) return resolveWorkImageSrc(primaryPart.thumbnail);
  const after = primaryPart.after;
  const thumbnail = after.replace(
    /^\/works\/(.+)-after\.(?:jpe?g|png|webp)$/i,
    '/works/thumbnails/$1.jpg',
  );
  return resolveWorkImageSrc(thumbnail === after ? after : thumbnail);
}

export function getAbsoluteWorkImageUrl(path: string, origin: string) {
  const resolved = resolveWorkImageSrc(path);
  return /^https?:\/\//i.test(resolved)
    ? resolved
    : `${origin.replace(/\/$/, '')}${resolved}`;
}

export function getWorkImageAlt(
  work: WorkItem,
  part: WorkPartMedia,
  state: '전' | '후',
) {
  const car = [work.carMaker, work.carModel].filter(Boolean).join(' ');
  const partDescription = getPartImageDescription(part);

  return `서울 동대문 ${car} ${partDescription} 수리 ${state}`.replace(/\s+/g, ' ').trim();
}
