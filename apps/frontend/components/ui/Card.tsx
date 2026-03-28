import clsx from 'clsx'

export default function Card({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={clsx('rounded-2xl border border-line bg-panel shadow-panel', className)}>
      {children}
    </div>
  )
}
