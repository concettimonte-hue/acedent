// Ephemeral local preview; real draft handlers use in-memory D1 and synthetic JWT.
// No .env, remote D1/R2, customer mutation, image uploads, or deployment.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import { loadTs } from './test-support.mjs';
import { draftFixture, completePayload } from './draft-test-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const f = draftFixture();
const access = await accessFixture({ after() {} });
Object.assign(f.env, access.env);
const api = loadTs('functions/admin/api/drafts/[id].ts');
const port = Number(process.env.BODY_PREVIEW_PORT || 4197);
let failNextDraft = false;
let fixtureWork = { ...completePayload(), slug: 'local-editor-test', part: ['도어'],
  parts: [{ ...completePayload().parts[0], label: '도어 측면', before: '/__preview__/before.svg', after: '/__preview__/after.svg', thumbnail: '/__preview__/after.svg' }],
};
const fixtureAssets = ['before', 'after'].map(kind => ({ object_key: `local/${kind}`, public_url: `/__preview__/${kind}.svg`, kind, part_index: 0, bytes: 100, width: 1600, height: 1200 }));
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
          const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
          if (req.method === 'POST' && url.pathname === '/__preview__/fail-next-draft') {
            failNextDraft = true; json(200, { message: '다음 임시저장 1회만 실패하도록 설정했습니다.' }); return;
          }
          if (url.pathname.match(/^\/__preview__\/(before|after)\.svg$/)) {
            res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#282d28"/><text x="150" y="600" fill="#f8db00" font-size="70">LOCAL PREVIEW ONLY</text></svg>'); return;
          }
          if (url.pathname === '/admin/api/works/local-editor-test' && req.method === 'GET') { json(200, { work: fixtureWork, assets: fixtureAssets }); return; }
          if (url.pathname === '/admin/api/works/local-editor-test' && req.method === 'PUT') {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            const p = JSON.parse(Buffer.concat(chunks));
            // Local response stub to exercise saved-vs-deployment-failed UI; no published DB write.
            fixtureWork = { ...fixtureWork, title: p.title, body: p.body, summary: p.summary };
            json(200, { work: fixtureWork }); return;
          }
          if (url.pathname === '/admin/api/deploy' && req.method === 'POST') { json(503, { error: '로컬 검증: 저장 성공 후 배포 실패 재현 (실제 배포 없음)' }); return; }
          const match = url.pathname.match(/^\/admin\/api\/drafts\/([a-f0-9-]+)$/);
          if (match && ['PUT', 'GET'].includes(req.method)) {
            if (req.method === 'PUT' && failNextDraft) { failNextDraft = false; req.resume(); json(503, { error: '로컬 검증용 저장 실패 · 다시 저장할 수 있습니다.' }); return; }
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
          if (!['/preview/editor', '/preview/admin', '/preview/edit', '/admin'].includes(url.pathname)) return next();
          const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>본문 편집기 로컬 미리보기</title><style>.body-preview-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px}@media(max-width:800px){.body-preview-grid{grid-template-columns:minmax(0,1fr)}}</style></head><body style="background:#080908"><aside style="padding:12px;background:#282715;color:#f5e67d;font:14px/1.6 sans-serif">로컬 예시 · 운영 사례/DB/사진 변경 없음 · 임시저장은 이 프로세스 메모리에만 보관됩니다.</aside><div id="root"></div><script type="module" src="/scripts/body-editor-preview.tsx"></script></body></html>`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html);
        } catch (error) { console.error(error); res.writeHead(500); res.end('Local preview error'); }
      });
    },
  }],
});
await server.listen();
console.log(`Local preview: http://127.0.0.1:${port}/preview/editor`);
