import Container from './ui/Container'
import Section from './ui/Section'

const faqs = [
  {
    question: 'Какие источники можно подключить?',
    answer: 'Карты, каталоги, сайты с отзывами, web-страницы и пользовательские источники. Конкретный список зависит от проекта и доступности данных.'
  },
  {
    question: 'Есть ли оповещения о новых отзывах и негативе?',
    answer: 'Да. Reputation OS может подсвечивать новые сигналы, негативные оценки и важные упоминания, чтобы команда быстрее увидела ситуацию и отреагировала.'
  },
  {
    question: 'Это замена CRM?',
    answer: 'Нет. Reputation OS фокусируется на репутации: отзывах, упоминаниях, источниках и сигналах, которые помогают команде быстрее реагировать.'
  },
  {
    question: 'Можно ли использовать для сети филиалов?',
    answer: 'Да, архитектура продукта рассчитана на работу с несколькими компаниями и точками.'
  },
  {
    question: 'Как часто обновляются данные?',
    answer: 'Частота зависит от настроек источников и выбранного сценария мониторинга.'
  },
  {
    question: 'Можно ли посмотреть демо?',
    answer: 'Да, можно написать в Telegram и получить демонстрацию.'
  },
  {
    question: 'Это официальная интеграция с площадками?',
    answer: 'Нет, лендинг не заявляет официальное партнёрство с площадками. Источники и сценарии сбора зависят от доступности данных и настроек проекта.'
  }
]

export default function FAQSection() {
  return (
    <Section id="faq" ariaLabel="Частые вопросы">
      <Container>
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-[34px] sm:text-4xl">
          FAQ
        </h2>

        <div className="mt-7 grid gap-4 sm:mt-10 lg:grid-cols-2">
          {faqs.map((faq) => (
            <details key={faq.question} className="glass group rounded-3xl p-5">
              <summary className="cursor-pointer list-none text-lg font-semibold text-white">
                {faq.question}
              </summary>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export { faqs }
