// SITE-013 read-only local UI fixture. No .env, uploads, publish/delete APIs or remote data.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import { loadTs } from './test-support.mjs';
import { accessFixture } from './access-test-fixture.mjs';
import { draftListFixture } from './draft-list-fixture.mjs';

const f = await draftListFixture();
const access = await accessFixture({ after() {} });
Object.assign(f.env, access.env);
const { onRequestGet } = loadTs('functions/admin/api/drafts.ts');
const root = fileURLToPath(new URL('..', import.meta.url));
const port = 4184;
let reads = 0,
  rejectedWrites = 0;
const server = await createServer({
  root,
  configFile: false,
  envFile: false,
  cacheDir: 'node_modules/.vite-draft-list-preview',
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [
    react(),
    {
      name: 'draft-list-read-only-fixture',
      resolveId(id) {
        if (id === '/draft-list-entry.js') return id;
      },
      load(id) {
        if (id === '/draft-list-entry.js')
          return `
import React from 'react';import{createRoot}from'react-dom/client';
import AdminDraftsList from'/components/AdminDraftsList.tsx';import'/app/globals.css';
document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&!a.href.includes('/preview/draft-list')){e.preventDefault();document.getElementById('fixture-link').textContent='이동 대상 확인 (실제 이동 차단): '+a.getAttribute('href');}});
createRoot(document.getElementById('root')).render(React.createElement(AdminDraftsList));`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          try {
            const url = new URL(req.url, `http://127.0.0.1:${port}`);
            if (url.pathname.startsWith('/admin/api/')) {
              res.setHeader('Cache-Control', 'no-store');
              if (req.method !== 'GET') {
                rejectedWrites++;
                res.statusCode = 405;
                res.end('Read-only fixture');
                return;
              }
              if (
                /^\/admin\/api\/drafts\/[a-f0-9-]+\/assets$/.test(url.pathname)
              ) {
                res.setHeader('Content-Type', 'image/svg+xml');
                res.end(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#282d27"/><rect x="40" y="75" width="240" height="95" rx="15" fill="#a9afa7"/><path d="M160 80V170M60 120H260" stroke="#393e39" stroke-width="4"/><text x="30" y="35" fill="#f8db00" font-size="18">LOCAL FIXTURE</text></svg>',
                );
                return;
              }
              if (url.pathname !== '/admin/api/drafts') {
                res.statusCode = 404;
                res.end('List fixture only');
                return;
              }
              reads++;
              const response = await onRequestGet({
                env: f.env,
                params: {},
                request: new Request(url, {
                  headers: { 'Cf-Access-Jwt-Assertion': await access.token() },
                }),
              });
              const data = await response.json();
              const scenario = new URL(
                req.headers.referer || url.href,
              ).searchParams.get('scenario');
              if (scenario === 'empty') data.drafts = [];
              if (scenario === 'completed')
                data.drafts = data.drafts.filter(
                  (d) => d.deploy_state === 'ready',
                );
              if (scenario === 'progress')
                data.drafts = data.drafts.filter(
                  (d) => d.deploy_state !== 'ready',
                );
              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return;
            }
            if (url.pathname === '/preview/state') {
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  reads,
                  rejectedWrites,
                  privatePuts: f.privateR2.puts,
                  privateDeletes: f.privateR2.deleted.length,
                  publicPuts: f.publicR2.puts,
                  publicDeletes: f.publicR2.deleted.length,
                  fixtureDrafts: 14,
                  note: 'privatePuts=56 are seeded in-memory placeholders, never uploaded',
                }),
              );
              return;
            }
            if (url.pathname !== '/preview/draft-list') return next();
            const html = await vite.transformIndexHtml(
              req.url,
              `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>SITE-013 로컬 목록 확인</title></head>
<body><nav style="padding:12px;background:#25281f;color:#eee;font:14px/1.7 sans-serif">
합성 목록 · 운영 데이터/저장/삭제 없음 · <a href="/preview/draft-list">전체 상태</a> ·
<a href="/preview/draft-list?scenario=empty">빈 목록</a> ·
<a href="/preview/draft-list?scenario=completed">완료만</a> ·
<a href="/preview/draft-list?scenario=progress">진행만</a>
<p id="fixture-link" role="status" style="overflow-wrap:anywhere"></p></nav>
<div id="root"></div><script type="module" src="/draft-list-entry.js"></script></body></html>`,
            );
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(html);
          } catch (error) {
            res.statusCode = 500;
            res.end('Fixture error: ' + error.message);
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(
  `SITE-013 local read-only preview: http://127.0.0.1:${port}/preview/draft-list`,
);
