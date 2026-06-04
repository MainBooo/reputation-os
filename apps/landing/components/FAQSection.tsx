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
      <div className="faq-premium">
        <Container>
          <div className="faq-premium__header">
            <h2 className="faq-premium__title">FAQ</h2>
            <div className="faq-premium__line" aria-hidden="true" />
            <p className="faq-premium__subtitle">
              Ответы на частые вопросы о возможностях Reputation OS
            </p>
          </div>

          <div className="faq-premium__grid">
            {faqs.map((faq) => (
              <details key={faq.question} className="faq-premium__item">
                <summary className="faq-premium__question">
                  <span className="faq-premium__question-text">{faq.question}</span>
                  <span className="faq-premium__controls" aria-hidden="true">
                    <span className="faq-premium__dot" />
                    <span className="faq-premium__icon">+</span>
                  </span>
                </summary>
                <p className="faq-premium__answer">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </div>
    </Section>
  )
}

export { faqs }
