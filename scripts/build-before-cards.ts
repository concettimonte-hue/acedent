import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import sharp from 'sharp/lib/index.js';
import type { Plugin } from 'vite';

const digest = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');

// This runs on the build machine. Only completed, smaller derivatives enter the manifest.
export function beforeCardsPlugin(sources: string[], thumbnails: Record<string, string>, root: string): Plugin {
  const files = new Map<string, Buffer>();
  const localWorks = resolve(root, 'public/works');
  const cache = resolve(root, 'node_modules/.cache/acedent-before-sources');
  const offline = process.env.ACEDENT_OFFLINE_BUILD === '1';
  const localBuild = process.env.CF_PAGES !== '1';
  async function readOriginal(src: string, origin: string) {
    if (src.startsWith('/works/')) {
      const path = resolve(localWorks, src.slice('/works/'.length));
      if (!path.startsWith(localWorks + sep)) throw new Error('Invalid local image path');
      return readFile(path);
    }
    const url = new URL(src);
    if (url.origin !== origin || !url.pathname.startsWith('/works/')) throw new Error('Unsupported image source');
    const cached = resolve(cache, digest(src));
    if (offline) return readFile(cached);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Image HTTP ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (localBuild) await writeFile(cached, bytes);
    return bytes;
  }
  return {
    name: 'acedent-before-card-images',
    apply: 'build',
    async config() {
      const config = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
      const origin = new URL(config.vars.R2_PUBLIC_BASE_URL).origin;
      if (localBuild && !offline) await mkdir(cache, { recursive: true });
      const unique = [...new Set(sources)];
      const pending = unique.values();
      const originals: string[] = [];
      async function convert() {
        for (const src of pending) {
          try {
            const bytes = await readOriginal(src, origin);
            const preview = await sharp(bytes, { limitInputPixels: 24_000_000 })
              .rotate().resize({ width: 720, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            if (preview.length >= bytes.length) continue;
            const name = 'card-images/' + digest(preview).slice(0, 24) + '.webp';
            files.set(name, preview);
            thumbnails[src] = '/' + name;
          } catch {
            originals.push(src);
          }
        }
      }
      await Promise.all(Array.from({ length: 4 }, convert));
      console.log(`Before card previews: ${Object.keys(thumbnails).length}/${unique.length}. Unavailable sources using original: ${originals.length}.`);
      // Stable ordering avoids changing the client bundle hash when downloads finish in a different order.
      const manifest = Object.fromEntries(Object.entries(thumbnails).sort(([a], [b]) => a.localeCompare(b)));
      return { define: { __ACEDENT_BEFORE_CARDS__: JSON.stringify(manifest) } };
    },
    generateBundle() {
      for (const [fileName, source] of files) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
