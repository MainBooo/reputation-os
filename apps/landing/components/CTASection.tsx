import ButtonLink from './ui/ButtonLink'
import Container from './ui/Container'
import Section from './ui/Section'

export default function CTASection() {
  return (
    <Section ariaLabel="Призыв к действию">
      <Container>
        <div className="glass overflow-hidden rounded-[1.5rem] p-5 text-center sm:rounded-[2rem] sm:p-8 sm:p-12">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[34px] sm:text-4xl">
            Покажите бизнесу, где репутация требует реакции
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-7 text-slate-300 sm:leading-8">
            Запустите Reputation OS как единый центр контроля отзывов, рейтингов, web-упоминаний, источников и оповещений.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="https://reputation.generationweb.ru">
              Открыть платформу
            </ButtonLink>
            <ButtonLink href="https://t.me/max92pole" variant="secondary" external>
              Запросить демо
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  )
}
