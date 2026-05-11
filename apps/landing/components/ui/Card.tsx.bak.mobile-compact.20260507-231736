import type { ReactNode } from 'react'
import clsx from 'clsx'

type CardProps = {
  children: ReactNode
  className?: string
}

export default function Card({ children, className }: CardProps) {
  return (
    <div className={clsx('glass rounded-3xl p-5 transition duration-300 hover:border-cyan-300/35 hover:shadow-glow', className)}>
      {children}
    </div>
  )
}
