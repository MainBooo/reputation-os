import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Реквизиты — Reputation OS',
}

export default function LegalPage() {
  return (
    <div className="max-w-xl">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white">Реквизиты исполнителя</h1>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
        <Row label="ФИО" value="Полякова Кристина Алексеевна" />
        <Divider />
        <Row label="ИНН" value="645325780844" />
        <Divider />
        <Row label="Статус" value="Самозанятый (плательщик налога на профессиональный доход)" />
        <Divider />
        <Row label="Вид деятельности" value="Разработка программного обеспечения / SaaS-сервис" />
        <Divider />
        <Row
          label="Email"
          value={
            <a
              href="mailto:max92pole@yandex.ru"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              max92pole@yandex.ru
            </a>
          }
        />
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        Условия использования сервиса — в{' '}
        <a href="/legal/oferta" className="text-cyan-400 hover:text-cyan-300">
          публичной оферте
        </a>
        , обработка персональных данных — в{' '}
        <a href="/legal/privacy" className="text-cyan-400 hover:text-cyan-300">
          политике конфиденциальности
        </a>
        .
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-200">{value}</dd>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-white/[0.06]" />
}
