import {
  WORK_PARTS,
  WORK_GALLERY_MAX_PER_SCOPE,
  WORK_GALLERY_MAX_TOTAL,
  getWorkCategoryLabel,
  isWorkCategory,
  isWorkPartPosition,
  isWorkPartValue,
  type WorkCategory,
  type WorkItem,
  type WorkGalleryImage,
  type WorkPartMedia,
} from '@/content/works/types';
import generatedWorksData from '@/content/works.generated.json';
import { workMatchesCategory } from '@/lib/work-categories';
import { formatWorkCardParts } from '@/lib/work-parts';
import { selectRelatedWorkSuggestions } from '@/lib/work-related';

interface GeneratedWorkRecord {
  sourceFile: string;
  lastModified: string;
  work: unknown;
}

interface GeneratedWorksData {
  records: GeneratedWorkRecord[];
}

function requireString(
  value: unknown,
  field: string,
  fileName: string,
) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fileName}: ${field} 값이 비어 있습니다.`);
  }
  return value;
}

function optionalString(value: unknown, field: string, fileName: string) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new Error(`${fileName}: ${field} 값이 문자열이 아닙니다.`);
  }
  return value.trim();
}

function parseGallery(value: unknown, field: string, fileName: string): WorkGalleryImage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > WORK_GALLERY_MAX_PER_SCOPE) {
    throw new Error(`${fileName}: ${field}는 최대 ${WORK_GALLERY_MAX_PER_SCOPE}개의 배열이어야 합니다.`);
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`${fileName}: ${field}[${index}] 값이 올바르지 않습니다.`);
    const image = entry as Record<string, unknown>;
    const width = Number(image.width);
    const height = Number(image.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 1600 || height > 1600) {
      throw new Error(`${fileName}: ${field}[${index}] 이미지 크기가 올바르지 않습니다.`);
    }
    return {
      src: requireString(image.src, `${field}[${index}].src`, fileName),
      thumbnail: optionalString(image.thumbnail, `${field}[${index}].thumbnail`, fileName) || undefined,
      caption: optionalString(image.caption, `${field}[${index}].caption`, fileName) || undefined,
      width,
      height,
    };
  });
}

function parseWork(value: unknown, fileName: string): WorkItem {
  const baseName = fileName.split('/').at(-1) ?? fileName;
  if (
    fileName.startsWith('content/works/') &&
    !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/.test(baseName)
  ) {
    throw new Error(`${fileName}: 파일명은 YYYY-MM-DD-slug.json 형식이어야 합니다.`);
  }
  if (!value || typeof value !== 'object') {
    throw new Error(`${fileName}: JSON 객체 형식이어야 합니다.`);
  }

  const item = value as Record<string, unknown>;
  const category = requireString(item.category, 'category', fileName);
  if (!isWorkCategory(category)) {
    throw new Error(`${fileName}: 허용되지 않은 category '${category}'입니다.`);
  }

  if (!Array.isArray(item.part) || item.part.length === 0) {
    throw new Error(`${fileName}: part는 한 개 이상의 배열이어야 합니다.`);
  }
  const workParts = item.part.map((part) => {
    if (typeof part !== 'string' || !isWorkPartValue(part)) {
      throw new Error(
        `${fileName}: part는 ${WORK_PARTS.join(', ')} 또는 직접 입력한 부위명이어야 합니다.`,
      );
    }
    return part;
  });

  const subCategories = item.subCategories === undefined ? [] : item.subCategories;
  if (!Array.isArray(subCategories) || subCategories.length > 2) {
    throw new Error(`${fileName}: subCategories는 최대 2개의 배열이어야 합니다.`);
  }
  const normalizedSubCategories = [...new Set(subCategories.map((subCategory) => {
    if (typeof subCategory !== 'string' || !isWorkCategory(subCategory) || subCategory === category) {
      throw new Error(`${fileName}: subCategories 값이 올바르지 않습니다.`);
    }
    return subCategory;
  }))];

  const subParts = item.subParts === undefined ? [] : item.subParts;
  if (!Array.isArray(subParts) || subParts.length > 2) {
    throw new Error(`${fileName}: subParts는 최대 2개의 배열이어야 합니다.`);
  }
  const normalizedSubParts = [...new Set(subParts.map((subPart) => {
    if (typeof subPart !== 'string' || !isWorkPartValue(subPart) || subPart === workParts[0]) {
      throw new Error(`${fileName}: subParts 값이 올바르지 않습니다.`);
    }
    return subPart;
  }))];

  if (!Array.isArray(item.parts) || item.parts.length === 0) {
    throw new Error(`${fileName}: parts는 한 개 이상의 배열이어야 합니다.`);
  }
  const parts = item.parts.map((value, index): WorkPartMedia => {
    if (!value || typeof value !== 'object') {
      throw new Error(`${fileName}: parts[${index}]는 객체 형식이어야 합니다.`);
    }
    const part = value as Record<string, unknown>;
    const partCategory = part.category === undefined || part.category === ''
      ? undefined
      : part.category;
    if (partCategory !== undefined && (
      typeof partCategory !== 'string' || !isWorkCategory(partCategory)
    )) {
      throw new Error(`${fileName}: parts[${index}].category 값이 올바르지 않습니다.`);
    }
    const partPosition = part.position === undefined || part.position === ''
      ? undefined
      : part.position;
    if (partPosition !== undefined && (
      typeof partPosition !== 'string' || !isWorkPartPosition(partPosition)
    )) {
      throw new Error(`${fileName}: parts[${index}].position 값이 올바르지 않습니다.`);
    }
    const mediaParts = Array.isArray(part.part)
      ? [...new Set(part.part.map((partValue) => {
          if (typeof partValue !== 'string' || !isWorkPartValue(partValue)) {
            throw new Error(`${fileName}: parts[${index}].part 값이 올바르지 않습니다.`);
          }
          return partValue;
        }))]
      : undefined;
    if (mediaParts && (mediaParts.length === 0 || mediaParts.length > 3)) {
      throw new Error(`${fileName}: parts[${index}].part는 1개 이상 3개 이하의 배열이어야 합니다.`);
    }
    return {
      part: mediaParts,
      position: partPosition,
      category: partCategory,
      label: requireString(part.label, `parts[${index}].label`, fileName),
      before: requireString(part.before, `parts[${index}].before`, fileName),
      after: requireString(part.after, `parts[${index}].after`, fileName),
      thumbnail:
        typeof part.thumbnail === 'string' && part.thumbnail.trim()
          ? part.thumbnail
          : undefined,
      note: requireString(part.note, `parts[${index}].note`, fileName),
      gallery: parseGallery(part.gallery, `parts[${index}].gallery`, fileName),
    };
  });

  const gallery = parseGallery(item.gallery, 'gallery', fileName);
  const totalGalleryImages = gallery.length + parts.reduce((count, part) => count + (part.gallery?.length ?? 0), 0);
  if (totalGalleryImages > WORK_GALLERY_MAX_TOTAL) {
    throw new Error(`${fileName}: 추가 사진은 사례 전체 최대 ${WORK_GALLERY_MAX_TOTAL}장이어야 합니다.`);
  }

  const date = requireString(item.date, 'date', fileName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${fileName}: date는 YYYY-MM-DD 형식이어야 합니다.`);
  }
  if (typeof item.featured !== 'boolean') {
    throw new Error(`${fileName}: featured는 true 또는 false여야 합니다.`);
  }
  if (item.sliderType !== 'drag' && item.sliderType !== 'split') {
    throw new Error(`${fileName}: sliderType은 drag 또는 split이어야 합니다.`);
  }

  return {
    slug: requireString(item.slug, 'slug', fileName),
    date,
    title: requireString(item.title, 'title', fileName),
    category,
    subCategories: normalizedSubCategories,
    part: workParts,
    subParts: normalizedSubParts,
    carMaker: requireString(item.carMaker, 'carMaker', fileName),
    carModel: optionalString(item.carModel, 'carModel', fileName),
    color:
      typeof item.color === 'string' && item.color.trim()
        ? item.color
        : undefined,
    parts,
    ogImage: optionalString(item.ogImage, 'ogImage', fileName) || undefined,
    gallery,
    summary: requireString(item.summary, 'summary', fileName),
    body: requireString(item.body, 'body', fileName),
    blogUrl:
      typeof item.blogUrl === 'string' && item.blogUrl.trim()
        ? item.blogUrl
        : undefined,
    featured: item.featured,
    featuredOrder:
      typeof item.featuredOrder === 'number' ? item.featuredOrder : undefined,
    days: requireString(item.days, 'days', fileName),
    sliderType: item.sliderType,
  };
}

const allWorks = (generatedWorksData as GeneratedWorksData).records
  .map(({ sourceFile, work }) => parseWork(work, sourceFile))
  .sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.featuredOrder ?? Number.MAX_SAFE_INTEGER),
  );

const duplicateSlug = allWorks.find(
  (work, index) => allWorks.findIndex((item) => item.slug === work.slug) !== index,
);
if (duplicateSlug) {
  throw new Error(`중복된 수리사례 slug: ${duplicateSlug.slug}`);
}

export function getWorks() {
  return [...allWorks];
}

export function getWorkBySlug(slug: string) {
  return allWorks.find((work) => work.slug === slug);
}

export function getWorksByCategory(category: WorkCategory) {
  return allWorks.filter((work) => workMatchesCategory(work, category));
}

export function getFeaturedWorks(limit = 8) {
  return allWorks
    .filter((work) => work.featured)
    .sort(
      (a, b) =>
        (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.featuredOrder ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, limit);
}

export function getRelatedWorks(work: WorkItem, limit = 3) {
  return getRelatedWorkSuggestions(work, limit).map(({ work: related }) => related);
}

export function getRelatedWorkSuggestions(work: WorkItem, limit = 3) {
  return selectRelatedWorkSuggestions(allWorks, work, limit);
}

export function formatWorkCar(work: WorkItem) {
  return [work.carMaker, work.carModel].filter(Boolean).join(' ');
}

export function formatWorkPartAndCategory(work: WorkItem) {
  return `${formatWorkCardParts(work)} · ${getWorkCategoryLabel(work.category)}`;
}
