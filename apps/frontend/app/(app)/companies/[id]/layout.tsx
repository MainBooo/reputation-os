import CompanyTabs from '@/components/layout/CompanyTabs'

export default function CompanyLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <div>
      <CompanyTabs companyId={params.id} />
      {children}
    </div>
  )
}
