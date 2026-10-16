// Local-only SITE-011 fixture. No env/credentials, D1, R2, or real deployment hooks.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { previewWork } from './preview-work-comparisons.mjs';
import { loadTs } from './test-support.mjs';

const { getWorksStaticHtml, getWorkDetailStaticHtml, getStaticWorkVehicleTag } = loadTs('lib/static-html.ts');

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = {
  alias: { ...previewWork, slug: 'brand-alias', carMaker: '메르세데스-벤츠 (Mercedes-Benz)', carModel: 'CLS450', title: '브랜드 선택 · 기존 표기 보존 미리보기', color: '검정' },
  unknown: { ...previewWork, slug: 'brand-unknown', carMaker: '현', carModel: '벨로스터', title: '미등록 제조사 · 직접 입력 보존 미리보기', color: '검정' },
  bmw: { ...previewWork, slug: 'brand-bmw', carMaker: 'BMW', carModel: '530i', title: '브랜드 선택 · 일반 사례 미리보기', color: '검정' },
  hyundai: { ...previewWork, slug: 'brand-hyundai', carMaker: '현대', carModel: '팰리세이드', title: '심볼 표시용 예시 · 실제 사례 아님', color: '검정' },
  lexus: { ...previewWork, slug: 'brand-lexus', carMaker: '렉서스', carModel: 'UX250h', title: '심볼 표시용 예시 · 실제 사례 아님', color: '검정' },
  genesis: { ...previewWork, slug: 'brand-genesis', carMaker: '제네시스', carModel: 'GV80', title: '심볼 표시용 예시 · 실제 사례 아님', color: '검정' },
  tesla: { ...previewWork, slug: 'brand-tesla', carMaker: '테슬라', carModel: '모델 3', title: '심볼 표시용 예시 · 실제 사례 아님', color: '검정' },
  porsche: { ...previewWork, slug: 'brand-porsche', carMaker: '포르쉐', carModel: '파나메라', title: '심볼 표시용 예시 · 실제 사례 아님', color: '검정' },
};

export async function startVehicleBrandPreview({ port = 4181 } = {}) {
  const saves = [];
  const assets = [];
  const addAsset = (url, kind, partIndex) => {
    if (!url || assets.some(asset => asset.public_url === url)) return;
    assets.push({ object_key: `works/local-brand/fixture-${assets.length}.jpg`, public_url: url, kind, part_index: partIndex, bytes: 1000, width: 1600, height: 1200 });
  };
  for (const [index, part] of previewWork.parts.entries()) {
    addAsset(part.before, 'before', index); addAsset(part.after, 'after', index); addAsset(part.thumbnail, 'thumbnail', index);
    for (const pair of part.comparisons || []) { addAsset(pair.before, 'before', index); addAsset(pair.after, 'after', index); }
    for (const image of part.gallery || []) { addAsset(image.src, 'gallery', index); addAsset(image.thumbnail, 'gallery-thumbnail', index); }
  }
  const entry = '/vehicle-brand-preview-entry.js';
  const server = await createServer({
    root, configFile: false, envFile: false, cacheDir: `${root}/node_modules/.vite-brand-preview`,
    resolve: { alias: { '@': root } }, css: { postcss: { plugins: [tailwindcss()] } },
    server: { host: '127.0.0.1', port, strictPort: port !== 0 },
    plugins: [react(), {
      name: 'local-vehicle-brand-preview',
      resolveId(id) { if (id === entry) return `\0${entry}`; },
      load(id) {
        if (id !== `\0${entry}`) return;
        return `import React from 'react'; import { createRoot } from 'react-dom/client';
          import AdminPage from '/components/AdminPage.tsx';
          import WorkDetailPage from '/components/WorkDetailPage.tsx';
          import WorkCard from '/components/WorkCard.tsx';
          import VehicleBrandLogo from '/components/VehicleBrandLogo.tsx';
          import WorkVehicleTag from '/components/WorkVehicleTag.tsx';
          import { VEHICLE_BRANDS } from '/lib/vehicle-brands.ts';
          import '/app/globals.css';
          document.addEventListener('click', event => { const a=event.target.closest('a'); if(a && !a.getAttribute('href')?.startsWith('/preview/') && !['/admin?view=new','/brands/credits.html'].includes(a.getAttribute('href'))) event.preventDefault(); });
          const fixtures=${JSON.stringify(fixtures)};
          const fixture=new URLSearchParams(location.search).get('fixture') || 'alias';
          const work=fixtures[fixture] || fixtures.alias;
          const path=location.pathname;
          let page;
          if(path.endsWith('/detail')) page=React.createElement(WorkDetailPage,{work});
          else if(path.endsWith('/cards')) page=React.createElement('main',{className:'works-page works-browser'},React.createElement('div',{className:'works-grid'},Object.values(fixtures).map(work=>React.createElement(WorkCard,{key:work.slug,work,showVehicleLogo:true,imageState:'before'}))));
          else if(path.endsWith('/logos')) page=React.createElement('main',{style:{padding:24}},React.createElement('h1',null,'브랜드 로고 연결 미리보기'),React.createElement('p',null,'22개 로컬 로고 · 현대 H / 렉서스 L / 제네시스 날개 / 테슬라 T / 포르쉐 방패'),React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:24,marginTop:24}},...VEHICLE_BRANDS.map(brand=>React.createElement('div',{key:brand.id,'data-brand-id':brand.id},React.createElement(WorkVehicleTag,{maker:brand.label,model:'모델명',showLogo:true})))),React.createElement('p',{style:{marginTop:32}},React.createElement('a',{href:'/brands/credits.html'},'로고 출처')));
          else if(path.endsWith('/logo-check')) page=React.createElement('main',{className:'works-page'},React.createElement('h1',null,'자산 로딩 시험 · 실제 브랜드 로고 아님'),...['generic','missing'].map(kind=>React.createElement('p',{key:kind,'data-testid':kind,style:{display:'flex',gap:8}},React.createElement(VehicleBrandLogo,{brand:{id:'test',label:'시험',aliases:[],logo:{src:'/brands/test-'+kind+'.svg',source:'local-only fixture',usageNote:'Not a brand logo',width:32}}}),kind==='generic'?'시험용 일반 도형':'불러오기 실패 → 텍스트만 표시')));
          else page=React.createElement(AdminPage,{editSlug:path.endsWith('/new') || path==='/admin'?undefined:work.slug});
          createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,page));`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const path = req.url?.split('?')[0];
          const json = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
          if (path === '/brands/test-generic.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="#c2c5c2"/></svg>'); return; }
          if (path === '/brands/test-missing.svg') return json({ error: 'intentional local missing asset' }, 404);
          if (path === '/preview/brands/saved') return json({ saves });
          if (path?.startsWith('/preview/brands/static-')) {
            let body = path.endsWith('detail')
              ? getWorkDetailStaticHtml(fixtures.bmw, [], 1, Object.values(fixtures))
              : getWorksStaticHtml(Object.values(fixtures));
            if (path.endsWith('missing')) body = '<main class="seo-static">' + getStaticWorkVehicleTag('현대', '팰리세이드').replace('/brands/hyundai-symbol.svg', '/brands/test-missing.svg') + '<script src="/vehicle-brand-logos.js" defer></script></main>';
            const html = await vite.transformIndexHtml(req.url, '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>정적 HTML 로고 시험</title><script type="module">import "/app/globals.css";</script></head><body>' + body + '</body></html>');
            res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); return;
          }
          if (path?.startsWith('/admin/api/')) {
            if (path === '/admin/api/session') return json({ authenticated: false });
            const work = Object.values(fixtures).find(item => path === `/admin/api/works/${item.slug}`);
            if (work && req.method === 'GET') return json({ work, assets });
            if (work && req.method === 'PUT') {
              const chunks = []; for await (const chunk of req) chunks.push(chunk);
              const payload = JSON.parse(Buffer.concat(chunks).toString());
              saves.push({ slug: work.slug, payload });
              return json({ work: { ...work, ...payload, slug: work.slug }, cleanupPending: 0 });
            }
            if (path === '/admin/api/deploy') return json(req.method === 'POST' ? { startedAt: new Date().toISOString(), deploymentId: 'local-only' } : { status: 'success' });
            return json({ error: 'Local preview: real uploads/writes are disabled.' }, 400);
          }
          if (!path?.startsWith('/preview/brands/') && path !== '/admin') return next();
          const html = await vite.transformIndexHtml(req.url, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SITE-011 로컬 미리보기</title></head><body>
            <nav style="padding:12px 16px;background:#24241b;color:#eee;font:13px/1.6 sans-serif">로컬 예시 · 운영 저장 없음 · 로고 22개 연결
            <a href="/preview/brands/admin" style="margin-left:16px">기존 사례</a> · <a href="/preview/brands/new">신규 입력</a> · <a href="/preview/brands/admin?fixture=unknown">직접 입력</a> · <a href="/preview/brands/cards">카드</a> · <a href="/preview/brands/detail">상세</a> · <a href="/preview/brands/logos">전체 로고</a> · <a href="/preview/brands/static-cards">정적 카드</a></nav>
            <div id="root"></div><script type="module" src="${entry}"></script></body></html>`);
          res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
        });
      },
    }],
  });
  await server.listen();
  return { server, origin: `http://127.0.0.1:${server.httpServer.address().port}`, getSaves: () => saves };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { origin } = await startVehicleBrandPreview();
  console.log(`Local-only preview: ${origin}/preview/brands/admin`);
}
