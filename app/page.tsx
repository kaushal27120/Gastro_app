import { redirect } from 'next/navigation'

export default function Home() {
  // Immediately send user to the login page
  redirect('/login')
}