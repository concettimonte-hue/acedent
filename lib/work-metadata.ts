import type { WorkCategory, WorkItem, WorkPart } from '../content/works/types';
import { getWorkCategoryLabel } from '../content/works/types';
import {
  getWorkImageAlt,
  getWorkGalleryImageAlt,
  getWorkComparisonImages,
  getAbsoluteWorkImageUrl,
  getWorkOgImageSrc,
  resolveWorkImageSrc,
} from './work-images';
import {
  getPageImageJsonLd,
  homeImage,
  pageImageJsonLdId,
  serializeJsonLd,
  siteUrl,
  worksOgImageAlt,
  worksOgImageUrl,
  type PageMetadata,
} from './seo';
import {
  getWorkPartLandingSeoCopy,
  getWorkSeoCopy,
  getWorksSeoCopy,
} from './work-seo';
import { getWorksCanonicalPath } from './work-routes';
import { getWorkPartLandingPath } from './work-landings';
import { getImageRightsMetadata } from './image-rights';
import { getWorkRepresentativePart, workMatchesCategory } from './work-categories';

const imageRightsMetadata = getImageRightsMetadata(siteUrl);

export type WorkMetadata = PageMetadata;

export function getWorkSeoTitle(work: WorkItem) {
  return getWorkSeoCopy(work).title;
}

/** 같은 날짜의 입력 순서에도 의존하지 않으며, 명시 PART → 기존 데이터 순으로 선택합니다. */
function getWorksPageImage(works: readonly WorkItem[], category?: WorkCategory, part?: WorkPart) {
  if (!category) return {
    image: worksOgImageUrl, imageAlt: worksOgImageAlt, imageWidth: 1200, imageHeight: 630,
  };

  const candidates = works
    .filter((work) => workMatchesCategory(work, category))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
    .map((work) => ({ work, media: getWorkRepresentativePart(work, category, part) }))
    .filter(({ media }) => !part || media.part?.includes(part));
  const selected = candidates.find(({ media }) => media.category === category)
    ?? candidates.find(({ work, media }) => !media.category && work.category === category);

  // 보조 작업만 일치하면 특정 PART와 결합하지 않습니다. 중립적인 업체 사진으로 대체.
  if (!selected) return homeImage;
  return {
    image: getAbsoluteWorkImageUrl(selected.media.before, siteUrl),
    imageAlt: getWorkImageAlt(selected.work, selected.media, '전'),
    imageWidth: 1600,
    imageHeight: 1200,
  };
}

export function getWorksMetadata(category?: WorkCategory, part?: WorkPart, works: readonly WorkItem[] = []): WorkMetadata {
  const { title, description } = category && part
    ? getWorkPartLandingSeoCopy(category, part)
    : getWorksSeoCopy(category);
  const canonical = `${siteUrl}${category && part
    ? getWorkPartLandingPath(category, part)
    : getWorksCanonicalPath(category)}`;

  return {
    title,
    description,
    canonical,
    ...getWorksPageImage(works, category, part),
  };
}

export function getWorkMetadata(work: WorkItem): WorkMetadata {
  const { title, description } = getWorkSeoCopy(work);
  return {
    title,
    description,
    canonical: `${siteUrl}/works/detail/${work.slug}`,
    image: getAbsoluteWorkImageUrl(getWorkOgImageSrc(work), siteUrl),
    imageWidth: work.ogImage ? 1200 : 1600,
    imageHeight: work.ogImage ? 630 : 1200,
    type: 'article',
    imageAlt: work.ogImage
      ? `${work.carMaker} ${work.carModel} ${work.title} 수리 전후 비교`.replace(/\s+/g, ' ').trim()
      : getWorkImageAlt(work, work.parts[0], '후'),
  };
}

export function getWorkImageJsonLd(work: WorkItem) {
  const ogImage = work.ogImage ? [{
    '@type': 'ImageObject',
    contentUrl: getAbsoluteWorkImageUrl(resolveWorkImageSrc(work.ogImage), siteUrl),
    thumbnailUrl: getAbsoluteWorkImageUrl(resolveWorkImageSrc(work.ogImage), siteUrl),
    name: `${work.carMaker} ${work.carModel} ${work.title} 수리 전후 비교`.replace(/\s+/g, ' ').trim(),
    caption: `${work.title} BEFORE AFTER 비교 이미지`,
    width: 1200,
    height: 630,
    representativeOfPage: true,
    ...imageRightsMetadata,
  }] : [];
  const partImages = work.parts.flatMap((part, partIndex) => [
    ...(['전', '후'] as const).map((state) => {
      const source = state === '전' ? part.before : part.after;
      const image = getAbsoluteWorkImageUrl(resolveWorkImageSrc(source), siteUrl);
      return {
        '@type': 'ImageObject',
        contentUrl: image,
        thumbnailUrl: image,
        name: getWorkImageAlt(work, part, state),
        caption: `${part.label}: ${part.note}`,
        width: 1600,
        height: 1200,
        representativeOfPage: !work.ogImage && partIndex === 0 && state === '후',
        ...imageRightsMetadata,
      };
    }),
    ...getWorkComparisonImages(work, part).map((image) => ({
      '@type': 'ImageObject',
      contentUrl: getAbsoluteWorkImageUrl(image.src, siteUrl),
      thumbnailUrl: getAbsoluteWorkImageUrl(image.src, siteUrl),
      name: image.title,
      caption: image.caption,
      width: 1600,
      height: 1200,
      representativeOfPage: false,
      ...imageRightsMetadata,
    })),
    ...(part.gallery ?? []).map((galleryImage, imageIndex) => ({
      '@type': 'ImageObject',
      contentUrl: getAbsoluteWorkImageUrl(resolveWorkImageSrc(galleryImage.src), siteUrl),
      thumbnailUrl: getAbsoluteWorkImageUrl(
        resolveWorkImageSrc(galleryImage.thumbnail || galleryImage.src),
        siteUrl,
      ),
      name: getWorkGalleryImageAlt(work, galleryImage, imageIndex, part),
      caption: galleryImage.caption || `${part.label} 추가 작업 사진`,
      width: galleryImage.width,
      height: galleryImage.height,
      representativeOfPage: false,
      ...imageRightsMetadata,
    })),
  ]);
  const workGalleryImages = (work.gallery ?? []).map((galleryImage, imageIndex) => ({
    '@type': 'ImageObject',
    contentUrl: getAbsoluteWorkImageUrl(resolveWorkImageSrc(galleryImage.src), siteUrl),
    thumbnailUrl: getAbsoluteWorkImageUrl(
      resolveWorkImageSrc(galleryImage.thumbnail || galleryImage.src),
      siteUrl,
    ),
    name: getWorkGalleryImageAlt(work, galleryImage, imageIndex),
    caption: galleryImage.caption || `${work.title} 전체 작업 추가 사진`,
    width: galleryImage.width,
    height: galleryImage.height,
    representativeOfPage: false,
    ...imageRightsMetadata,
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [...ogImage, ...partImages, ...workGalleryImages],
  };
}

export function getWorkBreadcrumbJsonLd(work: WorkItem) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '홈',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '수리사례',
        item: `${siteUrl}/works`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: getWorkCategoryLabel(work.category),
        item: `${siteUrl}/works/${work.category}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: work.title,
        item: `${siteUrl}/works/detail/${work.slug}`,
      },
    ],
  };
}

export function applyClientMetadata(metadata: WorkMetadata) {
  document.title = metadata.title;

  const setMeta = (selector: string, attribute: string, value: string) => {
    const element = document.head.querySelector<HTMLMetaElement>(selector);
    element?.setAttribute(attribute, value);
  };

  setMeta('meta[name="description"]', 'content', metadata.description);
  setMeta('meta[property="og:title"]', 'content', metadata.title);
  setMeta('meta[property="og:description"]', 'content', metadata.description);
  setMeta('meta[property="og:url"]', 'content', metadata.canonical);
  setMeta('meta[property="og:image"]', 'content', metadata.image);
  setMeta('meta[property="og:image:alt"]', 'content', metadata.imageAlt);
  setMeta('meta[property="og:image:width"]', 'content', String(metadata.imageWidth));
  setMeta('meta[property="og:image:height"]', 'content', String(metadata.imageHeight));
  setMeta('meta[property="og:type"]', 'content', metadata.type ?? 'website');
  setMeta('meta[name="twitter:title"]', 'content', metadata.title);
  setMeta('meta[name="twitter:description"]', 'content', metadata.description);
  setMeta('meta[name="twitter:image"]', 'content', metadata.image);

  document.head
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.setAttribute('href', metadata.canonical);

  let pageScript = document.getElementById(pageImageJsonLdId);
  if (!pageScript) {
    pageScript = document.createElement('script');
    pageScript.id = pageImageJsonLdId;
    pageScript.setAttribute('type', 'application/ld+json');
    document.head.appendChild(pageScript);
  }
  pageScript.textContent = serializeJsonLd(getPageImageJsonLd(metadata));
}
