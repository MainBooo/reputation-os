import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import MobileNav from '@/components/layout/MobileNav'
import MobileSidebarDrawer from '@/components/layout/MobileSidebarDrawer'
import { ChatProvider } from '@/lib/chat/ChatContext'
import ChatDrawer from '@/components/chat/ChatDrawer'
import { SubscriptionProvider } from '@/lib/subscription/SubscriptionContext'
import SubscriptionPopup from '@/components/billing/SubscriptionPopup'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('accessToken')?.value

  if (!token) {
    redirect('/login')
  }

  return (
    <ChatProvider>
      <SubscriptionProvider>
        <div className="min-h-screen overflow-x-hidden bg-[#050b12] text-white">
          <MobileSidebarDrawer />
          <div className="flex min-h-screen overflow-x-hidden">
            <Sidebar />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
              <Topbar />
              <main className="flex-1 min-w-0 px-4 py-4 lg:px-8 lg:py-6">
                {children}
              </main>
              <MobileNav />
            </div>
          </div>
          <ChatDrawer />
          <SubscriptionPopup />
        </div>
      </SubscriptionProvider>
    </ChatProvider>
  )
}
