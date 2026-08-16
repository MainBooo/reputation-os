import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import MobileSidebarDrawer from '@/components/layout/MobileSidebarDrawer'
import MobileMenuButton from '@/components/layout/MobileMenuButton'
import ScrollToTopButton from '@/components/layout/ScrollToTopButton'
import WorkspaceBootstrap from '@/components/layout/WorkspaceBootstrap'
import SessionGuard from '@/components/layout/SessionGuard'
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

  // Серверная проверка выше знает только, что cookie ПРИСУТСТВУЕТ — не что она
  // валидна. SessionGuard делает реальную проверку (GET /auth/me) на клиенте и
  // либо чистит просроченную/невалидную cookie и ведёт на /login, либо
  // показывает понятный экран ошибки — вместо того чтобы монтировать весь
  // shell (и его сайд-эффекты вроде сокет-подключения) с невалидным токеном.
  return (
    <SessionGuard>
      <ChatProvider>
        <SubscriptionProvider>
          <SidebarProvider>
            <div className="min-h-screen overflow-x-hidden bg-[#050b12] text-white">
              <WorkspaceBootstrap />
              <MobileSidebarDrawer />
              <MobileMenuButton />
              <ScrollToTopButton />
              <div className="flex min-h-screen overflow-x-hidden">
                <Sidebar />
                <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
                  <main className="flex-1 min-w-0 px-4 pb-4 pt-4 lg:px-8 lg:pb-6 lg:pt-6">
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
    </SessionGuard>
  )
}
