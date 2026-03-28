import clsx from 'clsx'

export function Select({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm text-muted">{label}</span> : null}
      <select
        className={clsx(
          'w-full rounded-xl border border-border bg-panel2 px-3.5 py-2.5 text-sm outline-none focus:border-white/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
