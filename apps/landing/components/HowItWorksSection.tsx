import { BellRing, Building2, PlugZap, Rows3 } from 'lucide-react'
import Card from './ui/Card'
import Container from './ui/Container'
import PlatformShot from './ui/PlatformShot'
import Section from './ui/Section'

const steps = [
  { icon: Building2, title: 'Добавляете компанию', text: 'Создаёте карточку бизнеса или точки.' },
  { icon: PlugZap, title: 'Подключаете источники', text: 'Добавляете карты, каталоги, сайты и web-источники.' },
  { icon: Rows3, title: 'Получаете сигналы', text: 'Отзывы, рейтинги и упоминания попадают в единый Inbox.' },
  { icon: BellRing, title: 'Реагируете быстрее', text: 'Платформа подсвечивает важные события и отправляет оповещения.' }
]

export default function HowItWorksSection() {
  return (
    <Section id="how-it-works" ariaLabel="Как работает Reputation OS">
      <Container>
        <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              Как это работает
            </h2>
            <p className="mt-3 max-w-xl text-[17px] leading-7 text-slate-300">
              От источника до реакции команды — в одном понятном процессе.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {steps.map((step, index) => (
                <Card key={step.title}>
                  <div className="mb-4 flex items-center justify-between">
                    <step.icon className="text-cyan-200" size={26} />
                    <span className="text-sm text-slate-500">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{step.text}</p>
                </Card>
              ))}
            </div>
          </div>

          <PlatformShot
            src="/screenshots/platform-company-create.jpeg"
            alt="Экран добавления компании в Reputation OS"
            label="Онбординг компании"
            caption="Добавление компании — первый шаг: название, сайт, город, отрасль и источники для дальнейшего мониторинга."
          />
        </div>
      </Container>
    </Section>
  )
}
