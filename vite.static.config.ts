import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import generatedWorksData from './content/works.generated.json';
import {
  WORK_CATEGORIES,
  isWorkPartValue,
  type WorkCategory,
  type WorkItem,
} from './content/works/types';
import {
  autoBodyShopJsonLd,
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
import {
  getAbsoluteWorkImageUrl,
  getWorkImageAlt,
  getWorkPrimaryAfterSrc,
  getWorkPrimaryPart,
} from './lib/work-images';

const projectDirectory = fileURLToPath(new URL('.', import.meta.url));
const sitemapFallbackDate = '2026-09-08';

interface BuildWork extends WorkItem {
  sourceFile: string;
  lastModified: string;
}

interface GeneratedWorksData {
  records: Array<{
    sourceFile: string;
    lastModified: string;
    work: WorkItem;
  }>;
}

function getGitLastModified(paths: string[], fallback = sitemapFallbackDate) {
  try {
    const date = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', ...paths],
      {
        cwd: projectDirectory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback;
  } catch {
    return fallback;
  }
}

function latestDate(...dates: string[]) {
  return dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) ?? sitemapFallbackDate;
}

function getWorkLastModified(work: BuildWork, sharedSources: string[]) {
  return latestDate(
    work.lastModified,
    getGitLastModified(sharedSources, work.lastModified),
  );
}

function loadBuildWorks(): BuildWork[] {
  const categoryIds = new Set<string>(WORK_CATEGORIES.map((item) => item.id));
  const works = (generatedWorksData as GeneratedWorksData).records
    .map(({ sourceFile, lastModified, work }) => {
      const fileName = sourceFile;

      if (!work.slug || !work.title || !work.date) {
        throw new Error(`${fileName}: slug, title, date는 필수입니다.`);
      }
      if (!categoryIds.has(work.category)) {
        throw new Error(`${fileName}: 허용되지 않은 category입니다.`);
      }
      if (!Array.isArray(work.part) || work.part.some((part) => typeof part !== 'string' || !isWorkPartValue(part))) {
        throw new Error(`${fileName}: 허용되지 않은 part가 있습니다.`);
      }
      if (
        !Array.isArray(work.parts) ||
        work.parts.length === 0 ||
        work.parts.some(
          (part) =>
            !part ||
            typeof part.label !== 'string' ||
            typeof part.before !== 'string' ||
            typeof part.after !== 'string' ||
            typeof part.note !== 'string' ||
            (part.part !== undefined && (
              !Array.isArray(part.part) ||
              part.part.some((partValue) => typeof partValue !== 'string' || !isWorkPartValue(partValue))
            )),
        )
      ) {
        throw new Error(`${fileName}: parts의 label, before, after, note는 필수입니다.`);
      }
      return { ...work, sourceFile, lastModified };
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
  return {
    '@context': 'https://schema.org',
    '@graph': work.parts.flatMap((part, partIndex) =>
      (['전', '후'] as const).map((state) => {
        const image = getAbsoluteWorkImageUrl(
          state === '전' ? part.before : part.after,
          siteUrl,
        );
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
    ),
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
        children: serializeJsonLd(autoBodyShopJsonLd),
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
    const sharedPageSources = [
      'vite.static.config.ts',
      'lib/static-html.ts',
      'lib/work-seo.ts',
      'lib/seo.ts',
    ];
    const homeLastModified = latestDate(getGitLastModified([
      ...sharedPageSources,
      'app/page.tsx',
      'content/site.json',
      'content/trust.json',
      'content/faq.json',
      'content/polish.json',
      'content/reviews.json',
      'content/insurance.json',
      'content/process.json',
    ]), ...works.map((work) => work.lastModified));
    const worksLastModified = latestDate(getGitLastModified([
      ...sharedPageSources,
      'components/WorksGalleryPage.tsx',
      'components/WorkCard.tsx',
    ]), ...works.map((work) => work.lastModified));
    const sitemapEntries = [
      {
        loc: siteUrl,
        lastmod: homeLastModified,
        changefreq: 'monthly',
        priority: '1.0',
      },
      {
        loc: `${siteUrl}/works`,
        lastmod: worksLastModified,
        changefreq: 'weekly',
        priority: '0.9',
      },
      ...WORK_CATEGORIES.map((category) => ({
        loc: `${siteUrl}/works/${category.id}`,
        lastmod: latestDate(getGitLastModified([
          ...sharedPageSources,
          'components/WorksGalleryPage.tsx',
          'components/WorkCard.tsx',
        ]), ...works
          .filter((work) => work.category === category.id)
          .map((work) => work.lastModified)),
        changefreq: 'weekly',
        priority: '0.8',
      })),
      ...works.map((work) => ({
        loc: `${siteUrl}/works/detail/${work.slug}`,
        lastmod: getWorkLastModified(work, [
          ...sharedPageSources,
          'components/WorkDetailPage.tsx',
          'components/BeforeAfterSlider.tsx',
        ]),
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
    const robots = `User-agent: *\nAllow: /\n\nHost: ${siteUrl}\nSitemap: ${siteUrl}/sitemap.xml\n`;

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

    writeRoute(
      'admin.html',
      renderRouteHtml(baseHtml, {
        title: '수리사례 관리 | 에이스덴트',
        description: '에이스덴트 수리사례 관리자 목록 및 입력 화면입니다.',
        canonical: `${siteUrl}/admin`,
        image: `${siteUrl}/og-image.jpg`,
        bodyHtml: '<main class="admin-page"><p class="admin-static-loading">관리자 화면을 불러오는 중입니다.</p></main>',
      }).replace(
        '<meta name="robots" content="index, follow" />',
        '<meta name="robots" content="noindex, nofollow" />',
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
          image: getAbsoluteWorkImageUrl(getWorkPrimaryAfterSrc(work), siteUrl),
          imageWidth: 1600,
          imageHeight: 1200,
          imageAlt: getWorkImageAlt(work, getWorkPrimaryPart(work), '후'),
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
