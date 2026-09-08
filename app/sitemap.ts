import type { MetadataRoute } from 'next';
import { WORK_CATEGORIES } from '@/content/works/types';
import { siteContentLastModified, siteUrl } from '@/lib/seo';
import { getWorks } from '@/lib/works';

export default function sitemap(): MetadataRoute.Sitemap {
  const works = getWorks();
  const siteModified = new Date(`${siteContentLastModified}T00:00:00+09:00`);
  const workModified = (date: string) =>
    new Date(`${date < siteContentLastModified ? siteContentLastModified : date}T00:00:00+09:00`);
  return [
    {
      url: siteUrl,
      lastModified: siteModified,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${siteUrl}/works`,
      lastModified: siteModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...WORK_CATEGORIES.map((category) => ({
      url: `${siteUrl}/works/${category.id}`,
      lastModified: siteModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...works.map((work) => ({
      url: `${siteUrl}/works/detail/${work.slug}`,
      lastModified: workModified(work.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
