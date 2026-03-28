import clsx from 'clsx'
import type { InputHTMLAttributes } from 'react'

export default function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-xl border border-line bg-panel2 px-3 py-2 text-sm text-brand placeholder:text-muted',
        className
      )}
      {...props}
    />
  )
}
