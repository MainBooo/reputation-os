import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Реквизиты — Reputation OS',
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#050b12] text-white">
      <div className="mx-auto max-w-xl px-6 py-20">
        <div className="mb-10">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Reputation OS</div>
          <h1 className="mt-2 text-2xl font-bold text-white">Реквизиты</h1>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <Row label="ФИО" value="Полякова Кристина Алексеевна" />
          <Divider />
          <Row label="ИНН" value="645325780844" />
          <Divider />
          <Row label="Статус" value="Самозанятый" />
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
      </div>
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
