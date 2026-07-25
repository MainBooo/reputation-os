import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import MobileSidebarDrawer from '@/components/layout/MobileSidebarDrawer'
import MobileMenuButton from '@/components/layout/MobileMenuButton'
import WorkspaceBootstrap from '@/components/layout/WorkspaceBootstrap'
import { ChatProvider } from '@/lib/chat/ChatContext'
import ChatDrawer from '@/components/chat/ChatDrawer'
import { SubscriptionProvider } from '@/lib/subscription/SubscriptionContext'
import SubscriptionPopup from '@/components/billing/SubscriptionPopup'
import { SidebarProvider } from '@/lib/layout/SidebarContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('accessToken')?.value

  if (!token) {
    redirect('/login')
  }

  return (
    <ChatProvider>
      <SubscriptionProvider>
        <SidebarProvider>
          <div className="min-h-screen overflow-x-hidden bg-[#050b12] text-white">
            <WorkspaceBootstrap />
            <MobileSidebarDrawer />
            <MobileMenuButton />
            <div className="flex min-h-screen overflow-x-hidden">
              <Sidebar />
              <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
                <main className="flex-1 min-w-0 px-4 pb-4 pt-16 lg:px-8 lg:pb-6 lg:pt-6">
                  {children}
                </main>
                <MobileNav />
              </div>
            </div>
            <ChatDrawer />
            <SubscriptionPopup />
          </div>
        </SidebarProvider>
      </SubscriptionProvider>
    </ChatProvider>
  )
}
