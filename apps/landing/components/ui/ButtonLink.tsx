import type { ReactNode } from 'react'
import clsx from 'clsx'

type ButtonLinkProps = {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
  external?: boolean
}

export default function ButtonLink({
  href,
  children,
  variant = 'primary',
  className,
  external = false
}: ButtonLinkProps) {
  const classes = clsx(
    'focus-ring inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition duration-300 sm:min-h-0',
    variant === 'primary' && 'bg-cyan-300 text-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.28)] hover:bg-cyan-200',
    variant === 'secondary' && 'border border-cyan-200/25 bg-white/5 text-cyan-50 hover:border-cyan-200/45 hover:bg-white/10',
    variant === 'ghost' && 'text-slate-200 hover:text-cyan-200',
    className
  )

  return (
    <a
      href={href}
      className={classes}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  )
}
