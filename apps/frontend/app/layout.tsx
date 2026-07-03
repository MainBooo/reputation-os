import './globals.css'
import type { Metadata, Viewport } from 'next'
import { YandexMetricaProvider } from 'next-yandex-metrica'
import Analytics from '@/components/Analytics'

const siteUrl = 'https://reputation.generationweb.ru'
const YANDEX_METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID
const isYandexMetrikaEnabled = process.env.NODE_ENV === 'production' && !!YANDEX_METRIKA_ID

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
  const body = (
    <>
      {children}
      <Analytics />
    </>
  )

  return (
    <html lang="ru">
      <body>
        {isYandexMetrikaEnabled ? (
          <YandexMetricaProvider
            tagID={Number(YANDEX_METRIKA_ID)}
            router="app"
            initParameters={{ clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true, ecommerce: 'dataLayer' }}
          >
            {body}
          </YandexMetricaProvider>
        ) : (
          body
        )}
      </body>
    </html>
  )
}
