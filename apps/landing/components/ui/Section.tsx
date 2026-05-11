import type { ReactNode } from 'react'
import clsx from 'clsx'

type SectionProps = {
  id?: string
  ariaLabel?: string
  children: ReactNode
  className?: string
}

export default function Section({ id, ariaLabel, children, className }: SectionProps) {
  return (
    <section id={id} aria-label={ariaLabel} className={clsx('py-12 sm:py-16 lg:py-24', className)}>
      {children}
    </section>
  )
}
