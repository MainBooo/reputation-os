import type { Metadata } from 'next'
import { YandexMetricaProvider } from 'next-yandex-metrica'
import Analytics from '@/components/Analytics'
import './globals.css'

const siteUrl = 'https://reputationos.generationweb.ru'
const YANDEX_METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID
const isYandexMetrikaEnabled = process.env.NODE_ENV === 'production' && !!YANDEX_METRIKA_ID

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Reputation OS — мониторинг отзывов и упоминаний бизнеса',
  description: 'Reputation OS собирает отзывы, рейтинги, упоминания и сигналы из карт, каталогов, сайтов с отзывами и web-источников в единый Inbox, показывает статусы сбора и оповещает о новых репутационных рисках.',
  keywords: [
    'управление репутацией',
    'мониторинг отзывов',
    'отзывы бизнеса',
    'репутация компании',
    'мониторинг упоминаний',
    'ORM',
    'Reputation OS'
  ],
  alternates: {
    canonical: siteUrl
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: 'Reputation OS — мониторинг отзывов и упоминаний бизнеса',
    description: 'Единый Inbox для отзывов, рейтингов, упоминаний и оповещений о репутационных рисках бизнеса.',
    url: siteUrl,
    siteName: 'Reputation OS',
    locale: 'ru_RU',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reputation OS — мониторинг отзывов и упоминаний бизнеса',
    description: 'Отзывы, рейтинги, упоминания и оповещения о рисках бизнеса в едином Inbox.'
  }
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
