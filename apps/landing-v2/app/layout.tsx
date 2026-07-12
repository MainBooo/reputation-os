import type { Metadata } from 'next';
import { Unbounded, Onest, JetBrains_Mono } from 'next/font/google';
import SmoothScroll from '@/components/providers/SmoothScroll';
import './globals.css';

const display = Unbounded({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Onest({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ReputationOS — репутация под контролем',
  description:
    'Все отзывы о вашем бизнесе — с Яндекс.Карт, 2ГИС и веб-источников — в одном инбоксе. AI-ответы, аналитика, Telegram-уведомления.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="bg-ink font-sans text-paper antialiased">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
