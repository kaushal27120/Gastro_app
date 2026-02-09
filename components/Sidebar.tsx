'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/app/supabase-client' 
import { useRouter, usePathname } from 'next/navigation'
import { Logo } from '@/components/Logo' // <--- Import

export function Sidebar() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"

  return (
    <div className="w-64 bg-slate-950 text-white min-h-screen flex flex-col fixed left-0 top-0 border-r border-slate-800 z-50">
      {/* BRAND HEADER */}
      <div className="p-6 border-b border-slate-800">
        <Logo textClassName="text-white" />
        <p className="text-xs text-slate-500 mt-2 pl-1">Control Tower</p>
      </div>
      
      {/* ... (Rest of your sidebar code remains the same) ... */}
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/admin">
          <div className={`flex items-center w-full px-4 py-3 rounded-md transition-colors font-medium cursor-pointer ${isActive('/admin')}`}>
            Dashboard
          </div>
        </Link>
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <Button variant="destructive" className="w-full justify-start pl-4" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>
          Log Out
        </Button>
      </div>
    </div>
  )
}