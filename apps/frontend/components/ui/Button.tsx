import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

export default function Button({
  className,
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition',
        variant === 'primary' && 'bg-brand text-black hover:opacity-90',
        variant === 'secondary' && 'bg-panel2 text-brand border border-line hover:bg-white/10',
        variant === 'ghost' && 'text-brand hover:bg-white/5',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
