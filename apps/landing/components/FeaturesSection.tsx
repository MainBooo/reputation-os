import { BellRing, CalendarDays, Filter, History, Inbox, Layers3, RefreshCw, ShieldAlert } from 'lucide-react'
import Card from './ui/Card'
import Container from './ui/Container'
import Section from './ui/Section'

const features = [
  {
    icon: Inbox,
    title: 'Единый Inbox',
    text: 'Отзывы, рейтинги и упоминания собираются в одну рабочую ленту.'
  },
  {
    icon: BellRing,
    title: 'Оповещения от платформы',
    text: 'Получайте сигнал, когда появляется новый отзыв, негативная оценка или важное упоминание.'
  },
  {
    icon: Filter,
    title: 'Фильтры по площадке, оценке, тональности и датам',
    text: 'Быстро находите нужные сигналы без ручного перебора источников.'
  },
  {
    icon: RefreshCw,
    title: 'Автоматический сбор',
    text: 'Платформа регулярно обновляет данные по подключённым источникам.'
  },
  {
    icon: ShieldAlert,
    title: 'Контроль негативных сигналов',
    text: 'Негативные оценки и важные события заметнее для команды.'
  },
  {
    icon: History,
    title: 'История источников',
    text: 'Видно, откуда пришёл сигнал и как менялась картина.'
  },
  {
    icon: Layers3,
    title: 'Готовность к новым площадкам',
    text: 'Архитектура рассчитана на расширение источников мониторинга.'
  },
  {
    icon: CalendarDays,
    title: 'Понятные статусы синхронизации',
    text: 'Команда понимает, что уже собрано и что требует проверки.'
  }
]

export default function FeaturesSection() {
  return (
    <Section id="features" ariaLabel="Возможности Reputation OS">
      <Container>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-[34px] sm:text-4xl">
            Что получает бизнес
          </h2>

          <div className="mt-7 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <feature.icon className="mb-4 text-cyan-200" size={24} />
                <h3 className="text-base font-semibold leading-6 text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
