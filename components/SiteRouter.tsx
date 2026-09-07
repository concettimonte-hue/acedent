'use client';

import Home from '@/app/page';
import WorkDetailPage from '@/components/WorkDetailPage';
import WorksGalleryPage from '@/components/WorksGalleryPage';
import { isWorkCategory } from '@/content/works/types';
import { getWorkBySlug } from '@/lib/works';

function normalizePath(pathname: string) {
  const decoded = decodeURIComponent(pathname);
  if (decoded === '/') return decoded;
  return decoded.replace(/\/+$/, '');
}

function WorksNotFound() {
  return (
    <main className="works-page works-not-found">
      <p>404 · NOT FOUND</p>
      <h1>요청하신 수리사례를 찾을 수 없습니다.</h1>
      <a href="/works">전체 수리사례 보기</a>
    </main>
  );
}

export default function SiteRouter() {
  const path = normalizePath(window.location.pathname);
  if (path === '/') return <Home />;
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

  return <WorksNotFound />;
}
