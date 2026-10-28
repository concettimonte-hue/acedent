// Local preview with synthetic visits + the real read API. No .env or remote data.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import { loadTs } from './test-support.mjs';
import { analyticsFixture } from './analytics-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.ANALYTICS_PREVIEW_PORT || 4194);
const fixture = analyticsFixture();
const access = await accessFixture({ after() {} });
Object.assign(fixture.env, access.env);
const api = loadTs('functions/admin/api/analytics.ts');
const server = await createServer({
  root, configFile: false, envFile: false,
  cacheDir: 'node_modules/.vite-analytics-dates-preview',
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [react(), {
    name: 'local-analytics-preview',
    resolveId(id) { if (id === '/analytics-preview-entry.js') return id; },
    load(id) {
      if (id === '/analytics-preview-entry.js') return `
import React from 'react';import{createRoot}from'react-dom/client';
import Dashboard from '/components/AdminAnalyticsDashboard.tsx';import '/app/globals.css';
document.addEventListener('click',e=>{if(e.target.closest('a')){e.preventDefault();document.getElementById('preview-link').textContent='미리보기에서는 다른 페이지로 이동하지 않습니다.';}});
createRoot(document.getElementById('root')).render(React.createElement(Dashboard));`;
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, `http://127.0.0.1:${port}`);
          if (url.pathname === '/admin/api/analytics' && ['GET', 'POST'].includes(req.method)) {
            // POST only sets the existing owner-exclusion cookie; it never writes DB rows.
            const request = new Request(url, { method: req.method, headers: {
              'Cf-Access-Jwt-Assertion': await access.token(), Cookie: req.headers.cookie || '',
            } });
            const response = await api[req.method === 'GET' ? 'onRequestGet' : 'onRequestPost']({ request, env: fixture.env });
            res.writeHead(response.status, Object.fromEntries(response.headers));
            res.end(await response.text());
            return;
          }
          if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/api/') || !['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(403); res.end('Preview only'); return;
          }
          if (url.pathname !== '/preview/analytics') return next();
          const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>방문통계 유입·첫 페이지 미리보기</title>
</head><body><aside style="padding:12px 20px;background:#282715;color:#f5e67d;font:14px/1.6 sans-serif">배포 전 미리보기 · 모든 숫자·유입 출처는 테스트용 예시입니다. 실제 방문 기록·사례 변경 없음. 6일 전보다 오래된 날짜는 도입 전 상태 예시입니다.<span id="preview-link" role="status"></span></aside>
<div id="root"></div><script type="module" src="/analytics-preview-entry.js"></script></body></html>`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(html);
        } catch (error) { console.error(error); res.writeHead(500); res.end('Local preview error'); }
      });
    },
  }],
});
await server.listen();
console.log(`Local preview: http://127.0.0.1:${port}/preview/analytics (synthetic data only)`);
