import LandingHeader from '@/components/LandingHeader'
import LandingFooter from '@/components/LandingFooter'

export default function NotFound() {
  return (
    <div className="landing-shell">
      <div className="space-noise" />
      <LandingHeader />
      <main>
        <section
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '140px 28px 160px',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.32em', color: 'var(--muted)' }}>
            ОШИБКА 404
          </div>
          <h1 style={{ margin: '18px 0 0', fontSize: 'clamp(32px,4vw,48px)', lineHeight: 1.08, letterSpacing: '-0.04em' }}>
            Страница не найдена
          </h1>
          <p style={{ marginTop: 16, color: 'var(--muted)', lineHeight: 1.7 }}>
            Похоже, такой страницы не существует или она была перемещена. Вернитесь на главную —
            там всё найдётся.
          </p>
          <div style={{ marginTop: 34, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a className="btn btn-gradient btn-xl" href="/">
              На главную →
            </a>
            <a className="btn btn-glass btn-xl" href="/#pricing">
              Смотреть тарифы
            </a>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
