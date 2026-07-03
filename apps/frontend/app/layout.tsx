import './globals.css'
import type { Metadata, Viewport } from 'next'

const siteUrl = 'https://reputation.generationweb.ru'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Reputation OS',
  description: 'Личный кабинет Reputation OS — отзывы, упоминания и оповещения о репутационных рисках бизнеса в едином Inbox.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Reputation OS',
    description: 'Личный кабинет Reputation OS — отзывы, упоминания и оповещения о репутационных рисках бизнеса в едином Inbox.',
    url: siteUrl,
    siteName: 'Reputation OS',
    locale: 'ru_RU',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reputation OS',
    description: 'Личный кабинет Reputation OS — отзывы, упоминания и оповещения о репутационных рисках бизнеса.'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
