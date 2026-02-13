'use client'

import {
  BarChart3, FileText, CheckCircle, Package, Calendar,
  ClipboardList, RefreshCw, Lock, LineChart, History,
  FileSpreadsheet, LogOut, ChevronDown, ChevronRight,
  Building2, Shield,
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  id: string
  label: string
  icon: any
  badge?: number
}

type NavGroup = {
  title: string
  items: NavItem[]
  collapsible?: boolean
}

type SidebarProps = {
  adminName?: string
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  pendingInvoiceCount?: number
  pendingInventoryCount?: number
}

export function Sidebar({
  adminName = 'Admin',
  activeView,
  onNavigate,
  onLogout,
  pendingInvoiceCount = 0,
  pendingInventoryCount = 0,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleGroup = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const groups: NavGroup[] = [
    {
      title: 'PRZEGLĄD',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'pnl', label: 'Raport P&L', icon: LineChart },
      ],
    },
    {
      title: 'ZATWIERDZENIA',
      items: [
        { id: 'approvals', label: 'Faktury', icon: CheckCircle, badge: pendingInvoiceCount },
        { id: 'inv_approvals', label: 'Inwentaryzacje', icon: ClipboardList, badge: pendingInventoryCount },
      ],
    },
    {
      title: 'INWENTARYZACJA',
      collapsible: true,
      items: [
        { id: 'products', label: 'Produkty', icon: Package },
        { id: 'monthly', label: 'Miesięczna', icon: Calendar },
        { id: 'weekly', label: 'Tygodniowa', icon: ClipboardList },
      ],
    },
    {
      title: 'KONTROLA',
      collapsible: true,
      items: [
        { id: 'reconciliation', label: 'Uzgodnienie SEMIS', icon: RefreshCw },
        { id: 'monthclose', label: 'Zamknięcie miesiąca', icon: Lock },
      ],
    },
    {
      title: 'RAPORTY',
      collapsible: true,
      items: [
        { id: 'reports', label: 'Raporty zbiorcze', icon: BarChart3 },
        { id: 'history', label: 'Historia faktur', icon: History },
        { id: 'imported', label: 'Dane z Excela', icon: FileSpreadsheet },
      ],
    },
  ]

  return (
    <div className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col z-50">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Panel właściciela</h2>
            <p className="text-xs text-slate-400 truncate max-w-[140px]">{adminName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((group) => {
          const isCollapsed = group.collapsible && collapsed[group.title]
          return (
            <div key={group.title} className="mb-2">
              <button
                onClick={() => group.collapsible && toggleGroup(group.title)}
                className={`w-full flex items-center justify-between px-5 py-2 text-[10px] font-bold tracking-widest uppercase ${
                  group.collapsible
                    ? 'text-slate-400 hover:text-slate-200 cursor-pointer'
                    : 'text-slate-500 cursor-default'
                }`}
              >
                {group.title}
                {group.collapsible && (
                  isCollapsed
                    ? <ChevronRight className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeView === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all ${
                          isActive
                            ? 'bg-slate-700 text-white font-semibold border-r-2 border-blue-500'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all"
        >
          <LogOut className="w-4 h-4" />
          Wyloguj
        </button>
      </div>
    </div>
  )
}