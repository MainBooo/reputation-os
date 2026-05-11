import type { ReactNode } from 'react'
import clsx from 'clsx'

type ContainerProps = {
  children: ReactNode
  className?: string
}

export default function Container({ children, className }: ContainerProps) {
  return (
    <div className={clsx('mx-auto w-full max-w-[1220px] px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  )
}
