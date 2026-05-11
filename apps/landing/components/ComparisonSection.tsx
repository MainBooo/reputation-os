import { CheckCircle2, MinusCircle } from 'lucide-react'
import Container from './ui/Container'
import Section from './ui/Section'

const oldWay = [
  'менеджер вручную открывает площадки;',
  'новые отзывы легко пропустить;',
  'рейтинг виден отдельно от упоминаний;',
  'нет единого статуса сбора;',
  'команда реагирует поздно.'
]

const reputationOs = [
  'единый Inbox отзывов и упоминаний;',
  'оповещения о новых сигналах;',
  'рейтинги и источники в одном окне;',
  'понятные статусы синхронизации;',
  'команда быстрее реагирует на негатив.'
]

export default function ComparisonSection() {
  return (
    <Section ariaLabel="Сравнение подходов к мониторингу репутации">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Подход
          </p>
          <h2 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Не просто мониторинг — рабочий центр реакции
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Классические инструменты мониторинга часто рассчитаны на сложную аналитику и PR-команды. Reputation OS делает акцент на ежедневном контроле отзывов, рейтингов, источников и быстрых оповещениях для бизнеса.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-xl font-semibold text-white">
              Ручная проверка и разрозненные сервисы
            </h3>

            <ul className="mt-5 space-y-3">
              {oldWay.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-400 sm:text-[15px]">
                  <MinusCircle className="mt-0.5 shrink-0 text-slate-500" size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-200/25 bg-cyan-300/[0.05] p-5 shadow-2xl shadow-cyan-950/20 sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />

            <h3 className="relative text-xl font-semibold text-cyan-50">
              Reputation OS
            </h3>

            <ul className="relative mt-5 space-y-3">
              {reputationOs.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-200 sm:text-[15px]">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-200" size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  )
}
