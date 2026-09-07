import type { MetadataRoute } from 'next';
import { WORK_CATEGORIES } from '@/content/works/types';
import { siteUrl } from '@/lib/seo';
import { getWorks } from '@/lib/works';

export default function sitemap(): MetadataRoute.Sitemap {
  const works = getWorks();
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${siteUrl}/works`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...WORK_CATEGORIES.map((category) => ({
      url: `${siteUrl}/works/${category.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...works.map((work) => ({
      url: `${siteUrl}/works/detail/${work.slug}`,
      lastModified: new Date(work.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
