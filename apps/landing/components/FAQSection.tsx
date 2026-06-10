import Container from './ui/Container'
import Section from './ui/Section'

const faqs = [
  {
    question: 'Какие источники подключены?',
    answer: 'Яндекс Карты, 2ГИС и web-упоминания — статьи, форумы, сайты-отзовики. Список источников расширяется.'
  },
  {
    question: 'Как работают AI-ответы?',
    answer: 'Система анализирует текст отзыва, определяет тональность и генерирует готовый вариант ответа. Вы редактируете и отправляете — или используете как есть.'
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
    answer: 'Да — напишите в Telegram, покажем живой дашборд и ответим на вопросы: https://t.me/max92pole'
  },
  {
    question: 'Это официальная интеграция с Яндексом и 2ГИС?',
    answer: 'Нет. Данные собираются через публично доступные источники. Официального партнёрства нет.'
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
