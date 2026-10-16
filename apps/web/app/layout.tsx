import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'fullstack-toolkit',
  description: 'Monorepo 工程模板：Next.js + Fastify + Turborepo，内置质量门禁与性能预算'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
