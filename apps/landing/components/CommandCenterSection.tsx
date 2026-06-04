import Image from 'next/image'
import { BarChart3, BellRing, Inbox, ShieldCheck } from 'lucide-react'

const items = [
  { title: 'Все упоминания и отзывы — в одном месте', icon: Inbox },
  { title: 'Риски и негатив — под контролем', icon: BellRing },
  { title: 'Аналитика показывает рост', icon: BarChart3 },
  { title: 'Данные помогают принимать решения', icon: ShieldCheck },
]

export default function CommandCenterSection() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-28 sm:px-6 lg:px-8 lg:py-32">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-xl">
          <p className="mb-6 text-lg font-semibold uppercase tracking-[0.32em] text-cyan-300">
            Command Center
          </p>

          <h2 className="text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ваш центр управления репутацией
          </h2>

          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl sm:leading-9">
            Получайте полную картину в реальном времени: отзывы, упоминания,
            рейтинги и репутационные риски собраны в одном рабочем пространстве.
          </p>

            <div className="command-feature-list">
              {items.map(({ title, icon: Icon }) => (
                <div key={title} className="command-feature-row">
                  <span className="command-feature-icon">
                    <Icon size={24} strokeWidth={1.9} />
                  </span>
                  <span className="command-feature-title">{title}</span>
                </div>
              ))}
            </div>

          <a
            className="command-cta-glass"
            href="https://reputation.generationweb.ru/login"
          >
            Посмотреть демо панели →
          </a>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-cyan-300/[0.06] blur-3xl" />

          <div className="relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-white/[0.04] p-3 shadow-[0_20px_80px_rgba(0,0,0,0.35)] lg:transform" style={{ transform: "perspective(1200px) rotateY(-7deg) rotateX(2deg) rotateZ(1deg)", transformOrigin: "center" }}>
            <Image
              src="/images/hero/fon.png"
              alt="Command Center Reputation OS"
              width={980}
              height={620}
              className="h-auto w-full rounded-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
