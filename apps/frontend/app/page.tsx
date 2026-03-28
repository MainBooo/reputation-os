import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default function HomePage() {
  const token = cookies().get('accessToken')?.value
  redirect(token ? '/dashboard' : '/login')
}
