import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SiteRouter from '@/components/SiteRouter';
import { initializeSpaPageViews } from '@/lib/analytics';
import './globals.css';

initializeSpaPageViews();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteRouter />
  </StrictMode>,
);
