import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import siteData from '@/content/site.json';
import type { SiteContent } from '@/content/types';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const site = siteData as SiteContent;

export const metadata: Metadata = {
  title: site.meta.title,
  description: site.meta.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className={`${geistSans.variable} antialiased pb-20 md:pb-0`}>{children}</body></html>;
}
