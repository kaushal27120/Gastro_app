'use client'
import { useState } from 'react'
import { createClient } from '../supabase-client' 
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/Logo' // <--- Import Logo
import { getDashboardRoute } from '../roles' 

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    setLoading(true)
    
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert('Login failed: ' + error.message)
      setLoading(false)
      return
    }

    if (user) {
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()

      if (profile && profile.role) {
        const destination = getDashboardRoute(profile.role)
        router.push(destination)
      } else {
        alert("Error: User has no role assigned.")
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      
      {/* LOGO ABOVE CARD */}
      <div className="mb-8 scale-125">
        <Logo textClassName="text-slate-900" />
      </div>

      <Card className="w-full max-w-md border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold text-gray-900">Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="name@company.com"
                className="h-12 text-lg bg-gray-50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                className="h-12 text-lg bg-gray-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-lg bg-black hover:bg-gray-800 text-white font-bold"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-sm text-gray-400">© 2024 Akab Group. Internal System.</p>
    </div>
  )
}