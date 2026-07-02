'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const nav = [
  ['Возможности', '#features'],
  ['Тарифы', '#pricing'],
  ['FAQ', '#faq'],
]

export default function LandingHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <Link href="/" className="site-header__brand" aria-label="Reputation OS">
          <span className="site-header__logo">
            <Image src="/images/logo/logo.png" alt="Reputation OS" width={44} height={44} />
          </span>
          <span className="site-header__title">REPUTATION OS</span>
        </Link>

        <nav className="site-header__nav" aria-label="Основное меню">
          {nav.map(([label, href]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>

        <a className="site-header__cta" href="#pricing">
          Смотреть тарифы
        </a>

        <button
          type="button"
          className="site-header__burger"
          aria-label="Открыть меню"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '×' : '☰'}
        </button>
      </div>

      {open && (
        <div className="site-header__mobile">
          {nav.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a href="#pricing" onClick={() => setOpen(false)}>
            Смотреть тарифы
          </a>
        </div>
      )}
    </header>
  )
}
