import type { WorkCategory, WorkItem } from '@/content/works/types';
import { getWorkCategoryLabel } from '@/content/works/types';
import {
  getWorkImageAlt,
  getWorkGalleryImageAlt,
  getAbsoluteWorkImageUrl,
  getWorkPrimaryAfterSrc,
  resolveWorkImageSrc,
} from '@/lib/work-images';
import {
  ogImageUrl,
  siteUrl,
  worksOgImageAlt,
  worksOgImageUrl,
} from '@/lib/seo';
import { getWorkSeoCopy, getWorksSeoCopy } from '@/lib/work-seo';
import { getWorksCanonicalPath } from '@/lib/work-routes';

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

export function getWorksMetadata(category?: WorkCategory): WorkMetadata {
  const { title, description } = getWorksSeoCopy(category);
  const canonical = `${siteUrl}${getWorksCanonicalPath(category)}`;

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
    image: getAbsoluteWorkImageUrl(getWorkPrimaryAfterSrc(work), siteUrl),
  };
}

export function getWorkImageJsonLd(work: WorkItem) {
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
        representativeOfPage: partIndex === 0 && state === '후',
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
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [...partImages, ...workGalleryImages],
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
