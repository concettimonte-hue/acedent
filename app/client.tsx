import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SiteRouter from '@/components/SiteRouter';
import { initializeSpaPageViews } from '@/lib/analytics';
import { getLegacyWorksRedirect, getLegacyWheelRedirect } from '@/lib/work-routes';
import { getWorks } from '@/lib/works';
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

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteRouter />
    </StrictMode>,
  );
}
