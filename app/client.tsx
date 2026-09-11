import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SiteRouter from '@/components/SiteRouter';
import { initializeSpaPageViews } from '@/lib/analytics';
import { getLegacyWorksRedirect } from '@/lib/work-routes';
import './globals.css';

const legacyWorksRedirect = getLegacyWorksRedirect(
  window.location.pathname,
  window.location.search,
);

if (legacyWorksRedirect) {
  window.location.replace(legacyWorksRedirect);
} else {
  initializeSpaPageViews();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SiteRouter />
    </StrictMode>,
  );
}
