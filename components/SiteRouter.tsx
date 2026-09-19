'use client';

import { lazy, Suspense } from 'react';
import Home from '@/app/page';
import SiteFooter from '@/components/SiteFooter';
import WorkDetailPage from '@/components/WorkDetailPage';
import WorksGalleryPage from '@/components/WorksGalleryPage';
import { isWorkCategory } from '@/content/works/types';
import { getWorkBySlug } from '@/lib/works';
import { getWorks } from '@/lib/works';
import { getWorkPartLandingFilters } from '@/lib/work-routes';
import { hasWorkPartLanding } from '@/lib/work-landings';

const AdminPage = lazy(() => import('@/components/AdminPage'));
const AdminWorksList = lazy(() => import('@/components/AdminWorksList'));

function normalizePath(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  if (decoded === '/') return decoded;
  return decoded.replace(/\/+$/, '');
}

function WorksNotFound() {
  return (
    <>
      <main className="works-page works-not-found">
        <p>404 · NOT FOUND</p>
        <h1>요청하신 수리사례를 찾을 수 없습니다.</h1>
        <a href="/works">전체 수리사례 보기</a>
      </main>
      <SiteFooter />
    </>
  );
}

function AdminLoading() {
  return (
    <main className="admin-page">
      <p className="admin-static-loading" role="status">관리자 화면을 불러오는 중입니다.</p>
    </main>
  );
}

export default function SiteRouter() {
  const path = normalizePath(window.location.pathname);
  if (path === '/') return <Home />;
  if (path === '/admin') {
    const search = new URLSearchParams(window.location.search);
    const adminView = search.get('view');
    const editSlug = search.get('slug');
    return (
      <Suspense fallback={<AdminLoading />}>
        {adminView === 'new' ? (
          <AdminPage />
        ) : adminView === 'edit' && editSlug ? (
          <AdminPage editSlug={editSlug} />
        ) : (
          <AdminWorksList />
        )}
      </Suspense>
    );
  }
  if (path === '/works') return <WorksGalleryPage />;

  const detailMatch = path.match(/^\/works\/detail\/([^/]+)$/);
  if (detailMatch) {
    const work = getWorkBySlug(detailMatch[1]);
    return work ? <WorkDetailPage work={work} /> : <WorksNotFound />;
  }

  const categoryMatch = path.match(/^\/works\/([^/]+)$/);
  if (categoryMatch && isWorkCategory(categoryMatch[1])) {
    return <WorksGalleryPage category={categoryMatch[1]} />;
  }

  const partLanding = getWorkPartLandingFilters(path);
  if (
    partLanding?.category &&
    partLanding.part &&
    hasWorkPartLanding(getWorks(), partLanding.category, partLanding.part)
  ) {
    return <WorksGalleryPage category={partLanding.category} part={partLanding.part} />;
  }

  return <WorksNotFound />;
}
