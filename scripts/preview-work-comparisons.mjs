// Isolated localhost preview. All API writes are simulated in memory; no env,
// credentials, deployment hooks, operating database or R2 are used.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('..', import.meta.url));
const before = '/works/jeep-renegade-door-dent-before.jpg';
const after = '/works/jeep-renegade-door-dent-after.jpg';
export const previewWork = {
  slug: 'local-comparison-preview', date: '2026-10-15', title: '추가 전후 비교 · 로컬 미리보기',
  category: 'dent', subCategories: [], part: ['도어'], subParts: [], carMaker: '지프', carModel: '레니게이드',
  color: '예시 사진', days: '1일', featured: false, sliderType: 'drag', summary: '기존 PART 안에서 다른 각도의 전후 사진을 보여주는 구성입니다.',
  body: '미리보기용으로 기존 사진을 반복 배치했습니다. 운영 사례는 변경하지 않습니다.',
  parts: [{ part: ['도어'], label: '도어 조수석', category: 'dent', note: '대표 전후 비교는 그대로 두고, 그 아래에 추가 비교를 배치합니다.',
    before, after, thumbnail: after,
    comparisons: [{ before, after, caption: '다른 각도 전후 비교 · 예시 사진' }, { before, after }],
    gallery: [{ src: after, width: 1600, height: 1200, caption: '기존 추가 사진 갤러리도 유지됩니다.' }],
  }],
};

export async function startComparisonPreview({ port = 0 } = {}) {
  const assets = [];
  const imageByKey = new Map();
  const uploads = new Map();
  let savedPayload;
  const asset = (url, kind) => {
    const key = `works/local-preview/fixture-${kind}.jpg`;
    const row = { object_key: key, public_url: url, kind, part_index: 0, width: 1600, height: 1200, bytes: 1000 };
    assets.push(row); imageByKey.set(key, url);
  };
  asset(before, 'before'); asset(after, 'after');
  const entry = '/comparison-preview-entry.js';
  const server = await createServer({
    root, configFile: false, envFile: false,
    cacheDir: `${root}/node_modules/.vite-comparison-preview`,
    resolve: { alias: { '@': root } },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: { host: '127.0.0.1', port, strictPort: port !== 0 },
    plugins: [react(), {
      name: 'local-comparison-preview',
      resolveId(id) { if (id === entry) return `\0${entry}`; },
      load(id) {
        if (id !== `\0${entry}`) return;
        return `import React from 'react'; import { createRoot } from 'react-dom/client';
          import AdminPage from '/components/AdminPage.tsx';
          import WorkDetailPage from '/components/WorkDetailPage.tsx';
          import '/app/globals.css';
          // No analytics initialization. Disable outbound contact/navigation in this demo.
          document.addEventListener('click', (event) => { const link=event.target.closest('a'); if(link && !link.getAttribute('href')?.startsWith('/preview/')) event.preventDefault(); });
          const editing = location.pathname.endsWith('/admin');
          const work = ${JSON.stringify(previewWork)};
          if(new URLSearchParams(location.search).has('empty')) delete work.parts[0].comparisons;
          createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,
            editing ? React.createElement(AdminPage,{editSlug:work.slug}) : React.createElement(WorkDetailPage,{work})));
        `;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const path = req.url?.split('?')[0];
          const json = (body, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
          if (path?.startsWith('/preview/uploads/')) {
            const file = uploads.get(path); if (!file) return json({ error: 'not found' }, 404);
            res.setHeader('Content-Type', 'image/jpeg'); res.end(file); return;
          }
          if (path?.startsWith('/admin/api/')) {
            if (path === '/admin/api/session') return json({ authenticated: false });
            if (path === '/admin/api/images' && req.method === 'POST') {
              const chunks = []; for await (const chunk of req) chunks.push(chunk);
              const form = await new Request('http://127.0.0.1/admin/api/images', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body: Buffer.concat(chunks) }).formData();
              const field = (name) => { const value = form.get(name); if (typeof value !== 'string') throw new Error('Invalid local preview field'); return value; };
              const key = `works/${field('uploadId')}/${field('partIndex')}-${field('name')}-${field('kind')}.jpg`;
              const url = `/preview/uploads/${uploads.size + 1}.jpg`;
              uploads.set(url, Buffer.from(await form.get('file').arrayBuffer())); imageByKey.set(key, url);
              return json({ key, url }, 201);
            }
            if (path === '/admin/api/works/local-comparison-preview') {
              if (req.method === 'GET') return json({ work: previewWork, assets });
              if (req.method === 'PUT') {
                const chunks = []; for await (const chunk of req) chunks.push(chunk);
                savedPayload = JSON.parse(Buffer.concat(chunks).toString());
                return json({ work: { ...previewWork, ...savedPayload, slug: previewWork.slug }, cleanupPending: 0 });
              }
            }
            if (path === '/admin/api/deploy') return json(req.method === 'POST' ? { startedAt: new Date().toISOString(), deploymentId: 'local-only' } : { status: 'success' });
            return json({ error: '로컬 미리보기에서는 지원하지 않는 요청입니다.' }, 400);
          }
          if (!path?.startsWith('/preview/')) return next();
          const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>배포 전 로컬 미리보기</title>
            <style>.preview-notice{padding:12px 16px;background:#24241b;color:#eee;font:13px/1.6 sans-serif}.preview-notice a{color:#f8db00;margin-left:16px}</style>
            </head><body><nav class="preview-notice">로컬 예시 · 저장은 테스트만 · 운영 반영 없음<a href="/preview/admin">어드민 입력</a><a href="/preview/detail">공개 상세</a></nav><div id="root"></div><script type="module" src="${entry}"></script></body></html>`);
          res.setHeader('Content-Type', 'text/html'); res.end(html);
        });
      },
    }],
  });
  await server.listen();
  return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}`, getSavedPayload: () => savedPayload, getUploads: () => uploads };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { origin } = await startComparisonPreview({ port: 4175 });
  console.log(`Local-only preview: ${origin}/preview/admin and ${origin}/preview/detail`);
}
