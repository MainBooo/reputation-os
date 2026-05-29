import type { ReactNode } from 'react'

type SectionProps = {
  id?: string
  ariaLabel?: string
  children: ReactNode
  className?: string
}

export default function Section({ id, ariaLabel, children, className }: SectionProps) {
  const classes = [
    'w-full overflow-hidden py-11 sm:py-16 lg:py-24',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section id={id} aria-label={ariaLabel} className={classes}>
      {children}
    </section>
  )
}
