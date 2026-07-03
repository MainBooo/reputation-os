import Link from 'next/link'
import clsx from 'clsx'
import { variants } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050b12] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">404</div>
        <h1 className="mt-4 text-2xl font-semibold text-white">Страница не найдена</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Такой страницы не существует или она была перемещена. Проверьте адрес или вернитесь в личный кабинет.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className={clsx(
              'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
              'backdrop-blur-xl active:scale-[0.98]',
              variants.primary
            )}
          >
            В личный кабинет
          </Link>
          <Link
            href="/login"
            className={clsx(
              'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
              'backdrop-blur-xl active:scale-[0.98]',
              variants.secondary
            )}
          >
            Войти
          </Link>
        </div>
      </div>
    </div>
  )
}
