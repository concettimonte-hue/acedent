import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig, type Plugin } from 'vite';
import {
  autoRepairJsonLd,
  faqJsonLd,
  serializeJsonLd,
  siteUrl,
} from './lib/seo';

const seoAssetsPlugin = (): Plugin => ({
  name: 'acedent-seo-assets',
  transformIndexHtml: {
    order: 'pre',
    handler: () => [
      {
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        children: serializeJsonLd(autoRepairJsonLd),
        injectTo: 'head',
      },
      {
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        children: serializeJsonLd(faqJsonLd),
        injectTo: 'head',
      },
    ],
  },
  generateBundle() {
    const lastModified = new Date().toISOString();
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}</loc>\n    <lastmod>${lastModified}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`;
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\nHost: ${siteUrl}\n`;

    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
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
