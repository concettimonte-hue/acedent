import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import SiteRouter from '@/components/SiteRouter';
import { initializeSpaPageViews } from '@/lib/analytics';
import { getLegacyWorksRedirect, getLegacyWheelRedirect } from '@/lib/work-routes';
import { getWorks } from '@/lib/works';
import './home-sections.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';

const legacyWorksRedirect = getLegacyWorksRedirect(
  window.location.pathname,
  window.location.search,
);
const redirect = legacyWorksRedirect || getLegacyWheelRedirect(window.location.pathname, window.location.search, getWorks());

if (redirect) {
  window.location.replace(redirect);
} else {
  initializeSpaPageViews();

  const root = document.getElementById('root')!;
  const app = <StrictMode><SiteRouter /></StrictMode>;
  if (root.hasAttribute('data-prerendered')) {
    hydrateRoot(root, app);
  } else {
    createRoot(root).render(app);
  }
}
