import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('accessToken')?.value

  if (token) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
