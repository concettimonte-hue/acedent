import type { WorkCategory, WorkItem, WorkPart } from '@/content/works/types';
import { getWorkCategoryLabel } from '@/content/works/types';
import {
  getWorkImageAlt,
  getWorkGalleryImageAlt,
  getAbsoluteWorkImageUrl,
  getWorkOgImageSrc,
  resolveWorkImageSrc,
} from '@/lib/work-images';
import {
  ogImageUrl,
  siteUrl,
  worksOgImageAlt,
  worksOgImageUrl,
} from '@/lib/seo';
import {
  getWorkPartLandingSeoCopy,
  getWorkSeoCopy,
  getWorksSeoCopy,
} from '@/lib/work-seo';
import { getWorksCanonicalPath } from '@/lib/work-routes';
import { getWorkPartLandingPath } from '@/lib/work-landings';
import { getImageRightsMetadata } from '@/lib/image-rights';

const imageRightsMetadata = getImageRightsMetadata(siteUrl);

export interface WorkMetadata {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt?: string;
}

export function getWorkSeoTitle(work: WorkItem) {
  return getWorkSeoCopy(work).title;
}

export function getWorksMetadata(category?: WorkCategory, part?: WorkPart): WorkMetadata {
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
    image: category ? ogImageUrl : worksOgImageUrl,
    imageAlt: category ? '에이스덴트 로고' : worksOgImageAlt,
  };
}

export function getWorkMetadata(work: WorkItem): WorkMetadata {
  const { title, description } = getWorkSeoCopy(work);
  return {
    title,
    description,
    canonical: `${siteUrl}/works/detail/${work.slug}`,
    image: getAbsoluteWorkImageUrl(getWorkOgImageSrc(work), siteUrl),
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
  if (metadata.imageAlt) {
    setMeta('meta[property="og:image:alt"]', 'content', metadata.imageAlt);
  }
  setMeta('meta[name="twitter:title"]', 'content', metadata.title);
  setMeta('meta[name="twitter:description"]', 'content', metadata.description);
  setMeta('meta[name="twitter:image"]', 'content', metadata.image);

  document.head
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.setAttribute('href', metadata.canonical);
}
