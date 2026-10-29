// Ephemeral local preview; real draft handlers use in-memory D1 and synthetic JWT.
// No .env, remote D1/R2, customer mutation, image uploads, or deployment.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import { loadTs } from './test-support.mjs';
import { draftFixture } from './draft-test-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const f = draftFixture();
const access = await accessFixture({ after() {} });
Object.assign(f.env, access.env);
const api = loadTs('functions/admin/api/drafts/[id].ts');
const port = Number(process.env.BODY_PREVIEW_PORT || 4197);
const server = await createServer({
  root, configFile: false, envFile: false,
  cacheDir: 'node_modules/.vite-body-editor-preview',
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [react(), {
    name: 'isolated-body-editor-preview',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, `http://127.0.0.1:${port}`);
          const match = url.pathname.match(/^\/admin\/api\/drafts\/([a-f0-9-]+)$/);
          if (match && ['PUT', 'GET'].includes(req.method)) {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            const request = new Request(`https://www.acedentshop.co.kr${url.pathname}`, {
              method: req.method,
              headers: { 'Cf-Access-Jwt-Assertion': await access.token(), Origin: 'https://www.acedentshop.co.kr', 'Content-Type': 'application/json' },
              ...(req.method === 'PUT' ? { body: Buffer.concat(chunks) } : {}),
            });
            const response = await api[req.method === 'PUT' ? 'onRequestPut' : 'onRequestGet']({ request, env: f.env, params: { id: match[1] } });
            res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
          }
          if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/api/') || !['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(403); res.end('Local text-only preview: action blocked'); return;
          }
          if (!['/preview/editor', '/preview/admin', '/admin'].includes(url.pathname)) return next();
          const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>본문 편집기 로컬 미리보기</title><style>.body-preview-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px}@media(max-width:800px){.body-preview-grid{grid-template-columns:minmax(0,1fr)}}</style></head><body style="background:#080908"><aside style="padding:12px;background:#282715;color:#f5e67d;font:14px/1.6 sans-serif">로컬 예시 · 운영 사례/DB/사진 변경 없음 · 임시저장은 이 프로세스 메모리에만 보관됩니다.</aside><div id="root"></div><script type="module" src="/scripts/body-editor-preview.tsx"></script></body></html>`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html);
        } catch (error) { console.error(error); res.writeHead(500); res.end('Local preview error'); }
      });
    },
  }],
});
await server.listen();
console.log(`Local preview: http://127.0.0.1:${port}/preview/editor`);
