import PageState from '@/components/ui/PageState'

export default function Loading() {
  return (
    <PageState
      tone="loading"
      title="Загружаем данные"
      description="Получаем актуальную информацию и готовим страницу."
    />
  )
}
