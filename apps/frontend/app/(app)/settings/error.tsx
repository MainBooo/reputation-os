'use client'

import PageState from '@/components/ui/PageState'
import Button from '@/components/ui/Button'

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageState
      tone="error"
      title="Не удалось загрузить страницу"
      description="Проверьте соединение или попробуйте обновить данные."
      action={
        <Button type="button" onClick={() => reset()}>
          Повторить
        </Button>
      }
    />
  )
}
