import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import MobileNav from '@/components/layout/MobileNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('accessToken')?.value

  if (!token) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#050b12] text-white">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-4 lg:px-8 lg:py-6">
            {children}
            <div className="h-24 lg:hidden" />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
