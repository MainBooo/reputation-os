import CompanyTabs from '@/components/layout/CompanyTabs'

export default function CompanyLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <>
      <CompanyTabs companyId={params.id} />
      {children}
    </>
  )
}
