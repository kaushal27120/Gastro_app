'use client'

import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, FileText, ClipboardList, LogOut, MapPin
} from 'lucide-react'

type OpsSidebarProps = {
  locationName: string
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  onSwitchLocation: () => void
}

export function OpsSidebar({
  locationName,
  activeView,
  onNavigate,
  onLogout,
  onSwitchLocation,
}: OpsSidebarProps) {
  const navItems = [
    { key: 'reporting', label: 'Raport dzienny', icon: LayoutDashboard },
    { key: 'invoices', label: 'Faktury', icon: FileText },
    { key: 'inventory', label: 'Inwentaryzacja', icon: ClipboardList },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">Panel Operacyjny</h1>
        <button
          onClick={onSwitchLocation}
          className="mt-2 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <MapPin className="w-4 h-4" />
          <span className="truncate">{locationName}</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant="ghost"
            onClick={() => onNavigate(key)}
            className={`w-full justify-start text-left h-11 ${
              activeView === key
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5 mr-3" />
            {label}
          </Button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Wyloguj
        </Button>
      </div>
    </aside>
  )
}