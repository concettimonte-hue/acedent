// Isolated, ephemeral SITE-012 preview. Uses actual handlers + synthetic JWT/D1/R2 only.
// Never loads .env. All upstream calls are intercepted; no production data writes.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadTs } from './test-support.mjs';
import { accessFixture } from './access-test-fixture.mjs';
import { draftFixture, seedDraft } from './draft-test-fixture.mjs';

const sharpPath = process.env.ACEDENT_PREVIEW_SHARP_MODULE;
if (!sharpPath)
  throw new Error(
    'Set ACEDENT_PREVIEW_SHARP_MODULE to the installed local sharp module. No installation or remote image is needed.',
  );
const { default: sharp } = await import(pathToFileURL(sharpPath).href);
const image = async (kind) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="${kind === 'before' ? '#343a40' : '#5d635b'}"/><rect x="170" y="220" width="1260" height="720" rx="70" fill="#999e9e" stroke="#151815" stroke-width="10"/><rect x="260" y="280" width="1080" height="220" fill="#353d43"/><path d="M800 520V920M260 540H1340" stroke="#333" stroke-width="10"/>${kind === 'before' ? '<path d="M870 610L1050 800M900 600L1080 790M860 650L1030 830" stroke="#e6e4d8" stroke-width="15"/>' : ''}<text x="100" y="110" font-size="60" fill="#ffe600">LOCAL SYNTHETIC ${kind.toUpperCase()}</text><text x="100" y="1100" font-size="45" fill="#fff">NOT A CUSTOMER PHOTO</text></svg>`,
    ),
  )
    .resize(
      kind === 'thumbnail' ? 800 : kind === 'og-image' ? 1200 : 1600,
      kind === 'thumbnail' ? 600 : kind === 'og-image' ? 630 : 1200,
    )
    .jpeg({ quality: 75 })
    .toBuffer();
const pictures = Object.fromEntries(
  await Promise.all(
    ['before', 'after', 'thumbnail', 'og-image'].map(async (kind) => [
      kind,
      await image(kind),
    ]),
  ),
);
const f = draftFixture();
const access = await accessFixture({ after() {} });
Object.assign(f.env, access.env);
const certFetch = globalThis.fetch;
const reviewed = await seedDraft(f, {
  complete: true,
  state: 'review',
  imageBytes: (kind) => pictures[kind],
});
const partial = await seedDraft(f, {
  complete: true,
  state: 'writing',
  imageBytes: (kind) => pictures[kind],
});
partial.payload.title = '비공개 미완성 초안 · BEFORE만 저장';
partial.payload.body = '';
partial.payload.parts[0].after = undefined;
partial.payload.parts[0].thumbnail = undefined;
partial.payload.ogImage = undefined;
f.db
  .prepare('UPDATE work_drafts SET payload_json=? WHERE id=?')
  .run(JSON.stringify(partial.payload), partial.id);
const deploymentId = 'abcdef12-1234-5678-9012-abcdef123456';
let hooks = 0;
globalThis.fetch = async (url, options) => {
  const address =
    url instanceof Request ? url.url : url instanceof URL ? url.href : url;
  if (url === f.env.DEPLOY_HOOK_URL) {
    hooks++;
    return Response.json({ result: { id: deploymentId } });
  }
  if (address.startsWith('https://api.cloudflare.com/')) {
    const d = {
      id: deploymentId,
      environment: 'production',
      created_on: new Date().toISOString(),
      deployment_trigger: { metadata: { branch: 'main' } },
      latest_stage: { status: 'success' },
    };
    return Response.json({
      success: true,
      result: address.includes('/deployments/')
        ? d
        : { canonical_deployment: d },
    });
  }
  if (address.startsWith('https://www.acedentshop.co.kr/')) {
    const record = f.db.prepare('SELECT payload_json FROM works LIMIT 1').get();
    const w = record ? JSON.parse(record.payload_json) : null;
    return new Response(
      w
        ? `<link href="https://www.acedentshop.co.kr/works/detail/${w.slug}"><img src="${w.parts[0].after}"><loc>https://www.acedentshop.co.kr/works/detail/${w.slug}</loc>`
        : '',
      { status: w ? 200 : 404 },
    );
  }
  return certFetch(url, options);
};
const modules = {
  list: loadTs('functions/admin/api/drafts.ts'),
  draft: loadTs('functions/admin/api/drafts/[id].ts'),
  assets: loadTs('functions/admin/api/drafts/[id]/assets.ts'),
  publish: loadTs('functions/admin/api/drafts/[id]/publish.ts'),
};
const root = fileURLToPath(new URL('..', import.meta.url));
const port = 4183;
const server = await createServer({
  root,
  configFile: false,
  envFile: false,
  cacheDir: 'node_modules/.vite-private-drafts-preview',
  resolve: { alias: { '@': root } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [
    react(),
    {
      name: 'private-drafts-fixture',
      resolveId(id) {
        if (id === '/private-drafts-entry.js') return id;
      },
      load(id) {
        if (id === '/private-drafts-entry.js')
          return `import React from 'react';import{createRoot}from'react-dom/client';import AdminPage from'/components/AdminPage.tsx';import AdminDraftsList from'/components/AdminDraftsList.tsx';import'/app/globals.css';const s=new URLSearchParams(location.search);document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&new URL(a.href).origin!==location.origin)e.preventDefault();});const view=s.get('view');createRoot(document.getElementById('root')).render(view==='draft'||view==='draft-preview'||view==='new'?React.createElement(AdminPage,{draftId:s.get('id')||undefined,previewOnly:view==='draft-preview'}):React.createElement(AdminDraftsList));`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          try {
            const url = new URL(req.url, 'http://127.0.0.1:' + port);
            if (url.pathname === '/preview/fixture.jpg') {
              res.setHeader('Content-Type', 'image/jpeg');
              res.end(pictures.before);
              return;
            }
            if (url.pathname === '/preview/state') {
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  hooks,
                  publicWorks: f.db
                    .prepare('SELECT count(*) n FROM works')
                    .get().n,
                  privateImages: f.privateR2.objects.size,
                  publicImages: f.publicR2.objects.size,
                  reviewed: reviewed.id,
                  partial: partial.id,
                }),
              );
              return;
            }
            if (url.pathname.startsWith('/admin/api/')) {
              if (url.pathname === '/admin/api/session') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ authenticated: false }));
                return;
              }
              const match = url.pathname.match(
                /^\/admin\/api\/drafts(?:\/([a-f0-9-]+)(?:\/(assets|publish))?)?$/,
              );
              if (!match) {
                res.statusCode = 404;
                res.end('Fixture API only');
                return;
              }
              const handlerModule = match[2]
                ? modules[match[2]]
                : match[1]
                  ? modules.draft
                  : modules.list;
              const handler =
                handlerModule[
                  'onRequest' +
                    req.method[0] +
                    req.method.slice(1).toLowerCase()
                ];
              if (!handler) {
                res.statusCode = 405;
                res.end();
                return;
              }
              const chunks = [];
              let length = 0;
              for await (const chunk of req) {
                length += chunk.length;
                if (length > 300000)
                  throw new Error('Fixture request too large');
                chunks.push(chunk);
              }
              const headers = new Headers(req.headers);
              if (req.headers['x-fixture-unauthenticated'] !== '1')
                headers.set('Cf-Access-Jwt-Assertion', await access.token());
              const response = await handler({
                env: f.env,
                params: match[1] ? { id: match[1] } : {},
                request: new Request(url, {
                  method: req.method,
                  headers,
                  body: ['GET', 'HEAD'].includes(req.method)
                    ? undefined
                    : Buffer.concat(chunks),
                }),
              });
              res.statusCode = response.status;
              response.headers.forEach((v, k) => res.setHeader(k, v));
              res.end(Buffer.from(await response.arrayBuffer()));
              return;
            }
            if (
              url.pathname !== '/admin' &&
              !url.pathname.startsWith('/preview/drafts')
            )
              return next();
            const html = await vite.transformIndexHtml(
              req.url,
              `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SITE-012 로컬 초안 검증</title></head><body><nav style="padding:12px;background:#26291e;color:white;font:14px sans-serif">로컬 합성 자료 · 운영 저장/발행 없음 · 종료 시 초기화 <a href="/admin?view=drafts">목록</a> · <a href="/admin?view=draft&id=${partial.id}">미완성 예시</a> · <a href="/admin?view=draft-preview&id=${reviewed.id}">검토 예시</a> · <a href="/admin?view=new">새 초안</a></nav><div id="root"></div><script type="module" src="/private-drafts-entry.js"></script></body></html>`,
            );
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(html);
          } catch (error) {
            res.statusCode = 500;
            res.end('Local fixture error: ' + error.message);
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(
  `Local synthetic preview: http://127.0.0.1:${port}/admin?view=drafts`,
);
