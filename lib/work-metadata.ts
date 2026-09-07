import type { WorkCategory, WorkItem } from '@/content/works/types';
import { getWorkCategoryLabel } from '@/content/works/types';
import { resolveWorkImageSrc } from '@/lib/work-images';
import { siteUrl } from '@/lib/seo';

export interface WorkMetadata {
  title: string;
  description: string;
  canonical: string;
  image: string;
}

export function getWorksMetadata(category?: WorkCategory): WorkMetadata {
  const categoryLabel = category ? getWorkCategoryLabel(category) : '';
  const title = category
    ? `${categoryLabel} 수리사례 | 에이스덴트`
    : '수리사례 | 에이스덴트';
  const description = category
    ? `서울 동대문 에이스덴트의 ${categoryLabel} 전후 작업사례를 확인하세요.`
    : '서울 동대문 에이스덴트의 덴트, 판금도색, 부분도색, 교환도색, 광택·복원 전후 작업사례를 확인하세요.';
  const canonical = category ? `${siteUrl}/works/${category}` : `${siteUrl}/works`;

  return { title, description, canonical, image: `${siteUrl}/og-image.jpg` };
}

export function getWorkMetadata(work: WorkItem): WorkMetadata {
  return {
    title: `${work.title} | 에이스덴트 수리사례`,
    description: work.summary,
    canonical: `${siteUrl}/works/detail/${work.slug}`,
    image: `${siteUrl}${resolveWorkImageSrc(work.after)}`,
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
  setMeta('meta[name="twitter:title"]', 'content', metadata.title);
  setMeta('meta[name="twitter:description"]', 'content', metadata.description);
  setMeta('meta[name="twitter:image"]', 'content', metadata.image);

  document.head
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.setAttribute('href', metadata.canonical);
}
