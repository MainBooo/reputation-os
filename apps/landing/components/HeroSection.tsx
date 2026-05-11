'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import ButtonLink from './ui/ButtonLink'
import Container from './ui/Container'
import PlatformShot from './ui/PlatformShot'

const badges = [
  'Оповещения о новых отзывах',
  'Контроль рейтинга',
  'Источники и web-упоминания'
]

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-[calc(40px+env(safe-area-inset-bottom))] pt-10 sm:pb-16 sm:pt-16 lg:pb-24 lg:pt-24">
      <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <Container className="grid items-center gap-7 sm:gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 sm:px-4 sm:py-2 sm:text-sm">
            Репутация бизнеса в одном окне
          </div>

          <h1 className="max-w-4xl text-balance text-[40px] font-semibold leading-[0.98] tracking-tight text-white sm:text-5xl sm:leading-tight lg:text-6xl">
            Отзывы, рейтинги и упоминания — в одном Inbox с оповещениями
          </h1>

          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Reputation OS собирает сигналы из карт, каталогов, сайтов с отзывами и web-источников, показывает статусы сбора и уведомляет команду о новых негативных сигналах.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <ButtonLink href="https://reputation.generationweb.ru" className="gap-2">
              Открыть платформу <ArrowRight size={17} />
            </ButtonLink>
            <ButtonLink href="https://t.me/max92pole" variant="secondary" external>
              Запросить демо
            </ButtonLink>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-cyan-200/15 bg-cyan-300/[0.06] px-3 py-1.5 text-sm leading-5 text-cyan-100"
              >
                {badge}
              </span>
            ))}
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
            Подходит для локального бизнеса, сетей, ресторанов, услуг и компаний с несколькими точками.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="relative"
        >
          <div className="absolute -inset-2 rounded-[2rem] bg-cyan-300/10 blur-2xl sm:-inset-4 sm:rounded-[2.5rem]" />
          <PlatformShot
            src="/screenshots/platform-dashboard-overview.jpeg"
            alt="Главный экран Reputation OS с обзором репутации и метриками компании"
            label="Dashboard"
            caption="Реальный экран платформы: обзор компании, рейтинг, сигналы и быстрый доступ к ключевым разделам."
            className="relative"
          />
        </motion.div>
      </Container>
    </section>
  )
}
