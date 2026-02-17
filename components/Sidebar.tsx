'use client'

import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, FileText, Receipt, ClipboardList, Package,
  Calendar, RefreshCw, Lock, BarChart3, History, FileSpreadsheet,
  LogOut, Bell, CheckSquare, Users
} from 'lucide-react'

type SidebarProps = {
  adminName: string
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  pendingInvoiceCount?: number
  pendingInventoryCount?: number
  unreadNotifications?: number  // Add this line
}

export function Sidebar({
  adminName,
  activeView,
  onNavigate,
  onLogout,
  pendingInvoiceCount = 0,
  pendingInventoryCount = 0,
  unreadNotifications = 0,  // Add this line
}: SidebarProps) {
  const navGroups = [
    {
      label: 'Przegląd',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { key: 'pnl', label: 'Rachunek P&L', icon: BarChart3 },
        { 
          key: 'notifications', 
          label: 'Powiadomienia', 
          icon: Bell, 
          badge: unreadNotifications  // Use the prop here
        },
      ],
    },
    {
      label: 'Zatwierdzenia',
      items: [
        { key: 'daily_reports', label: 'Raporty dzienne', icon: FileText },
        { key: 'approvals', label: 'Faktury', icon: Receipt, badge: pendingInvoiceCount },
        { key: 'inv_approvals', label: 'Inwentaryzacje', icon: CheckSquare, badge: pendingInventoryCount },
        { key: 'semis_verification', label: 'Uzgodnienia SEMIS', icon: RefreshCw },
      ],
    },
    {
      label: 'Inwentaryzacja',
      items: [
        { key: 'products', label: 'Produkty', icon: Package },
        { key: 'monthly', label: 'Miesięczna', icon: Calendar },
        { key: 'weekly', label: 'Tygodniowa', icon: ClipboardList },
      ],
    },
    {
      label: 'Raporty',
      items: [
        { key: 'reports', label: 'Raporty zbiorcze', icon: BarChart3 },
        { key: 'history', label: 'Historia faktur', icon: History },
        { key: 'imported', label: 'Dane z Excela', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Administracja',
      items: [
        { key: 'monthclose', label: 'Zamknięcie miesiąca', icon: Lock },
      ],
    },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">Panel Admina</h1>
        <p className="text-sm text-slate-400 mt-1">{adminName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(({ key, label, icon: Icon, badge }) => (
                <Button
                  key={key}
                  variant="ghost"
                  onClick={() => onNavigate(key)}
                  className={`w-full justify-start text-left h-10 relative ${
                    activeView === key || activeView.startsWith(key)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {label}
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Wyloguj
        </Button>
      </div>
    </aside>
  )
}