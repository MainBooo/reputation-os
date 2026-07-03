import Container from './ui/Container'
import Section from './ui/Section'

const faqs = [
  {
    question: 'Что такое Reputation OS?',
    answer: 'Reputation OS — это платформа для мониторинга отзывов и управления репутацией бизнеса. Сервис автоматически собирает отзывы и упоминания из Яндекс Карт, 2ГИС и web-источников, помогает отслеживать изменения репутации, анализировать показатели и быстро отвечать клиентам с помощью ИИ — всё в одном рабочем пространстве.'
  },
  {
    question: 'Какие источники поддерживаются?',
    answer: 'Сейчас Reputation OS поддерживает Яндекс Карты, 2ГИС и web-источники (сайты отзывов, каталоги, статьи и другие страницы). Список источников постепенно расширяется.'
  },
  {
    question: 'Как работают AI-ответы?',
    answer: 'После появления нового отзыва система автоматически предлагает готовый вариант ответа с учётом содержания, тональности и оценки. Ответ можно использовать без изменений либо быстро отредактировать перед публикацией.'
  },
  {
    question: 'Это CRM?',
    answer: 'Нет. Reputation OS не заменяет CRM. Платформа предназначена для мониторинга отзывов, анализа репутации, работы с упоминаниями и управления обратной связью клиентов.'
  },
  {
    question: 'Можно использовать для нескольких компаний или филиалов?',
    answer: 'Да. Вы можете подключить несколько компаний, работать с сетью филиалов, приглашать сотрудников и распределять права доступа внутри Workspace.'
  },
  {
    question: 'Как быстро появляются новые отзывы?',
    answer: 'Система регулярно проверяет подключённые источники. Новые отзывы и упоминания автоматически появляются в едином Inbox, а пользователи получают уведомления.'
  },
  {
    question: 'Можно попробовать бесплатно?',
    answer: 'Да. После регистрации каждому пользователю предоставляется бесплатный пробный период 7 дней с возможностями тарифа Business.'
  },
  {
    question: 'Это официальная интеграция с Яндексом и 2ГИС?',
    answer: 'Reputation OS использует общедоступные способы получения информации и не является официальным продуктом Яндекса или 2ГИС. Все товарные знаки принадлежат их правообладателям.'
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
