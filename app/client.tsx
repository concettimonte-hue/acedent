import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SiteRouter from '@/components/SiteRouter';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteRouter />
  </StrictMode>,
);
