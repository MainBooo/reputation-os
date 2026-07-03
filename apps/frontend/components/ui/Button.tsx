import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

export const variants = {
  primary:
    'border border-cyan-400/15 bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-violet-500/20 text-white shadow-[0_0_24px_rgba(59,130,246,0.14)] hover:border-cyan-300/35 hover:shadow-[0_0_34px_rgba(168,85,247,0.18)]',

  secondary:
    'border border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-400/25 hover:bg-cyan-500/[0.08] hover:text-white',

  ghost:
    'border border-transparent bg-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white'
}

export default function Button({
  className,
  children,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
        'backdrop-blur-xl active:scale-[0.98]',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
