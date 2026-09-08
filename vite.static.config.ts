import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import {
  WORK_CATEGORIES,
  WORK_PARTS,
  type WorkCategory,
  type WorkItem,
} from './content/works/types';
import {
  autoRepairJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  siteUrl,
} from './lib/seo';
import {
  getHomeStaticHtml,
  getWorkDetailStaticHtml,
  getWorksStaticHtml,
} from './lib/static-html';
import { getWorkSeoCopy, getWorksSeoCopy } from './lib/work-seo';

const worksDirectory = fileURLToPath(new URL('./content/works', import.meta.url));

function loadBuildWorks() {
  const categoryIds = new Set<string>(WORK_CATEGORIES.map((item) => item.id));
  const allowedParts = new Set<string>(WORK_PARTS);
  const works = readdirSync(worksDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/.test(fileName)) {
        throw new Error(`${fileName}: 파일명은 YYYY-MM-DD-slug.json 형식이어야 합니다.`);
      }
      const work = JSON.parse(
        readFileSync(`${worksDirectory}/${fileName}`, 'utf8'),
      ) as WorkItem;

      if (!work.slug || !work.title || !work.date) {
        throw new Error(`${fileName}: slug, title, date는 필수입니다.`);
      }
      if (!categoryIds.has(work.category)) {
        throw new Error(`${fileName}: 허용되지 않은 category입니다.`);
      }
      if (!Array.isArray(work.part) || work.part.some((part) => !allowedParts.has(part))) {
        throw new Error(`${fileName}: 허용되지 않은 part가 있습니다.`);
      }
      return work;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const slugs = new Set<string>();
  for (const work of works) {
    if (slugs.has(work.slug)) throw new Error(`중복된 수리사례 slug: ${work.slug}`);
    slugs.add(work.slug);
  }
  return works;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const escapeXml = escapeHtml;

interface RouteMetadata {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  type?: 'website' | 'article';
  jsonLd?: Array<{ id: string; data: unknown }>;
  bodyHtml: string;
}

function renderRouteHtml(baseHtml: string, metadata: RouteMetadata) {
  const values = {
    title: escapeHtml(metadata.title),
    description: escapeHtml(metadata.description),
    canonical: escapeHtml(metadata.canonical),
    image: escapeHtml(metadata.image),
    imageAlt: escapeHtml(metadata.imageAlt ?? '에이스덴트 수리사례'),
    type: metadata.type ?? 'website',
  };

  let html = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${values.title}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?>/i,
      `<meta name="description" content="${values.description}" />`,
    )
    .replace(
      /<link\s+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${values.canonical}" />`,
    )
    .replace(
      /<meta\s+property="og:type"[^>]*>/i,
      `<meta property="og:type" content="${values.type}" />`,
    )
    .replace(
      /<meta\s+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${values.canonical}" />`,
    )
    .replace(
      /<meta\s+property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${values.title}" />`,
    )
    .replace(
      /<meta\s+property="og:description"[\s\S]*?>/i,
      `<meta property="og:description" content="${values.description}" />`,
    )
    .replace(
      /<meta\s+property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${values.image}" />`,
    )
    .replace(
      /<meta\s+property="og:image:width"[^>]*>/i,
      `<meta property="og:image:width" content="${metadata.imageWidth ?? 1200}" />`,
    )
    .replace(
      /<meta\s+property="og:image:height"[^>]*>/i,
      `<meta property="og:image:height" content="${metadata.imageHeight ?? 630}" />`,
    )
    .replace(
      /<meta\s+property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${values.imageAlt}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${values.title}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"[\s\S]*?>/i,
      `<meta name="twitter:description" content="${values.description}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${values.image}" />`,
    )
    .replace(
      /<script[^>]*id="acedent-faq-jsonld"[^>]*>[\s\S]*?<\/script>/i,
      '',
    );

  if (metadata.jsonLd) {
    const scripts = metadata.jsonLd
      .map(
        ({ id, data }) =>
          `<script id="${id}" type="application/ld+json">${serializeJsonLd(data)}</script>`,
      )
      .join('\n');
    html = html.replace('</head>', `${scripts}\n</head>`);
  }
  return html.replace('<div id="root"></div>', `<div id="root">${metadata.bodyHtml}</div>`);
}

function getCategoryLabel(category: WorkCategory) {
  return WORK_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function getBreadcrumbJsonLd(work: WorkItem) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: '수리사례',
        item: `${siteUrl}/works`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: getCategoryLabel(work.category),
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

function getWorkImageJsonLd(work: WorkItem) {
  const image = `${siteUrl}${work.after}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: image,
    thumbnailUrl: image,
    name: `${work.carMaker} ${work.carModel} ${work.part.join('·')} ${getCategoryLabel(work.category)} 작업 후`,
    caption: work.summary,
    width: 1600,
    height: 1200,
    representativeOfPage: true,
  };
}

const seoAssetsPlugin = (): Plugin => ({
  name: 'acedent-seo-assets',
  transformIndexHtml: {
    order: 'pre',
    handler: () => [
      {
        tag: 'script',
        attrs: { id: 'acedent-business-jsonld', type: 'application/ld+json' },
        children: serializeJsonLd(autoRepairJsonLd),
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: { id: 'acedent-faq-jsonld', type: 'application/ld+json' },
        children: serializeJsonLd(faqJsonLd),
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: { id: 'acedent-organization-jsonld', type: 'application/ld+json' },
        children: serializeJsonLd(organizationJsonLd),
        injectTo: 'head',
      },
    ],
  },
  generateBundle() {
    const works = loadBuildWorks();
    const lastModified = new Date().toISOString();
    const sitemapEntries = [
      { loc: siteUrl, lastmod: lastModified, changefreq: 'monthly', priority: '1.0' },
      {
        loc: `${siteUrl}/works`,
        lastmod: lastModified,
        changefreq: 'weekly',
        priority: '0.9',
      },
      ...WORK_CATEGORIES.map((category) => ({
        loc: `${siteUrl}/works/${category.id}`,
        lastmod: lastModified,
        changefreq: 'weekly',
        priority: '0.8',
      })),
      ...works.map((work) => ({
        loc: `${siteUrl}/works/detail/${work.slug}`,
        lastmod: work.date,
        changefreq: 'monthly',
        priority: '0.7',
      })),
    ];
    const sitemapBody = sitemapEntries
      .map(
        (entry) =>
          `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
      )
      .join('\n');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapBody}\n</urlset>\n`;
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\nHost: ${siteUrl}\n`;

    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
  },
  writeBundle(options) {
    const works = loadBuildWorks();
    const outputDirectory = resolve(options.dir ?? 'dist');
    const baseHtml = readFileSync(resolve(outputDirectory, 'index.html'), 'utf8');

    const writeRoute = (fileName: string, html: string) => {
      const target = resolve(outputDirectory, fileName);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, html);
    };

    writeRoute(
      'index.html',
      baseHtml.replace(
        '<div id="root"></div>',
        `<div id="root">${getHomeStaticHtml(works)}</div>`,
      ),
    );

    const allWorksSeo = getWorksSeoCopy();

    writeRoute(
      'works.html',
      renderRouteHtml(baseHtml, {
        title: allWorksSeo.title,
        description: allWorksSeo.description,
        canonical: `${siteUrl}/works`,
        image: `${siteUrl}/og-image.jpg`,
        bodyHtml: getWorksStaticHtml(works),
      }),
    );

    for (const category of WORK_CATEGORIES) {
      const categorySeo = getWorksSeoCopy(category.id);
      const categoryWorks = works.filter((work) => work.category === category.id);
      writeRoute(
        `works/${category.id}.html`,
        renderRouteHtml(baseHtml, {
          title: categorySeo.title,
          description: categorySeo.description,
          canonical: `${siteUrl}/works/${category.id}`,
          image: `${siteUrl}/og-image.jpg`,
          bodyHtml: getWorksStaticHtml(categoryWorks, category.id),
        }),
      );
    }

    for (const work of works) {
      const canonical = `${siteUrl}/works/detail/${work.slug}`;
      const workSeo = getWorkSeoCopy(work);
      const related = works
        .filter((candidate) => candidate.category === work.category && candidate.slug !== work.slug)
        .slice(0, 3);
      writeRoute(
        `works/detail/${work.slug}.html`,
        renderRouteHtml(baseHtml, {
          title: workSeo.title,
          description: workSeo.description,
          canonical,
          image: `${siteUrl}${work.after}`,
          imageWidth: 1600,
          imageHeight: 1200,
          imageAlt: `${work.carMaker} ${work.carModel} ${work.title} 작업 후`,
          type: 'article',
          jsonLd: [
            { id: 'work-breadcrumb-jsonld', data: getBreadcrumbJsonLd(work) },
            { id: 'work-image-jsonld', data: getWorkImageJsonLd(work) },
          ],
          bodyHtml: getWorkDetailStaticHtml(work, related),
        }),
      );
    }
  },
});

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [seoAssetsPlugin(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
