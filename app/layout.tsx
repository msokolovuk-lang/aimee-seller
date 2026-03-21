import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AIMEE · Seller MVP',
  description: 'AI-powered Fashion Marketplace · Seller Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
