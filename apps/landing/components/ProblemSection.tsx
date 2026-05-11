import { AlertTriangle, Clock, History, Split } from 'lucide-react'
import Card from './ui/Card'
import Container from './ui/Container'
import Section from './ui/Section'

const items = [
  { icon: Split, title: 'Отзывы разбросаны по разным площадкам', text: 'Команде приходится проверять карты, каталоги, сайты и выдачу вручную.' },
  { icon: AlertTriangle, title: 'Негатив сложно заметить вовремя', text: 'Плохой отзыв или статья могут повлиять на продажи раньше, чем бизнес это увидит.' },
  { icon: History, title: 'Нет единой истории упоминаний', text: 'Источники, статусы и сигналы живут отдельно, без общей картины.' },
  { icon: Clock, title: 'Ручная проверка забирает время', text: 'Менеджеры тратят часы на повторяющиеся проверки вместо реакции на клиентов.' }
]

export default function ProblemSection() {
  return (
    <Section ariaLabel="Проблемы управления репутацией">
      <Container>
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-[34px] sm:text-4xl">
            Репутация теряется не в одном месте — она расползается по сети
          </h2>
        </div>

        <div className="mt-7 sm:mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <Card key={item.title}>
              <item.icon className="mb-5 text-cyan-200" size={26} />
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.text}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}
