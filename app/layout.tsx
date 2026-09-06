import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: '에이스덴트 | 동대문구 용두동 자동차 외형복원·판금도색',
  description:
    '서울 동대문구 용두동 자동차 외형복원 전문점 에이스덴트. 실제 수리사례를 확인하고 판금도색, 덴트, 광택 견적을 전화 또는 사진 문자로 상담하세요.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className={`${geistSans.variable} antialiased`}>{children}</body></html>;
}
