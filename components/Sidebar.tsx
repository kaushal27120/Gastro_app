'use client'

import { OneLinkLogo } from "@/components/onelink-logo";
import {
  LayoutDashboard, FileText, Receipt, ClipboardList, Package,
  Calendar, RefreshCw, Lock, BarChart3, History, FileSpreadsheet,
  LogOut, Bell, CheckSquare, DollarSign, AlertTriangle, Truck, Users,
} from 'lucide-react'

type SidebarProps = {
  adminName: string
  activeView: string
  onNavigate: (view: string) => void
  onLogout: () => void
  pendingInvoiceCount?: number
  pendingInventoryCount?: number
  unreadNotifications?: number
  subscriptionPlan?: string | null
}

export function Sidebar({
  adminName,
  activeView,
  onNavigate,
  onLogout,
  pendingInvoiceCount = 0,
  pendingInventoryCount = 0,
  unreadNotifications = 0,
  subscriptionPlan,
}: SidebarProps) {
  const navGroups = [
    {
      label: 'Overview',
      items: [
        { key: 'dashboard',      label: 'Dashboard',       icon: LayoutDashboard },
        { key: 'pnl',            label: 'P&L',             icon: BarChart3 },
        { key: 'notifications',  label: 'Powiadomienia',   icon: Bell, badge: unreadNotifications },
      ],
    },
    {
      label: 'Menu',
      items: [
        { key: 'ingredients',     label: 'Składniki',       icon: FileText },
        { key: 'dishes',          label: 'Receptury',       icon: ClipboardList },
        { key: 'menu_calculator', label: 'Kalkulator ceny', icon: DollarSign },
        { key: 'menu_pricing',    label: 'Wycena menu',     icon: BarChart3 },
      ],
    },
    {
      label: 'Magazyn',
      items: [
        { key: 'products',             label: 'Produkty',       icon: Package },
        { key: 'central_warehouse',    label: 'Stan magazynu',  icon: Truck },
        { key: 'warehouse_deviations', label: 'Odchylenia',     icon: AlertTriangle },
      ],
    },
    {
      label: 'Zatwierdzenia',
      items: [
        { key: 'daily_reports',      label: 'Raporty dzienne',  icon: FileText },
        { key: 'approvals',          label: 'Faktury',          icon: Receipt,    badge: pendingInvoiceCount },
        { key: 'inv_approvals',      label: 'Inwentaryzacje',   icon: CheckSquare,badge: pendingInventoryCount },
        { key: 'semis_verification', label: 'SEMIS',            icon: RefreshCw },
      ],
    },
    {
      label: 'Inwentaryzacja',
      items: [
        { key: 'monthly', label: 'Miesięczna', icon: Calendar },
        { key: 'weekly',  label: 'Tygodniowa', icon: ClipboardList },
      ],
    },
    {
      label: 'Raporty',
      items: [
        { key: 'reports',  label: 'Raporty',      icon: BarChart3 },
        { key: 'history',  label: 'Historia',     icon: History },
        { key: 'imported', label: 'Import Excel', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Harmonogram',
      items: [
        { key: 'schedule', label: 'Grafik pracy', icon: Calendar },
      ],
    },
    {
      label: 'Admin',
      items: [
        { key: 'employees',   label: 'Pracownicy',      icon: Users },
        { key: 'monthclose',  label: 'Zamknięcie m-ca', icon: Lock },
        { key: 'admin_users', label: 'Użytkownicy',     icon: BarChart3 },
      ],
    },
  ]

  const plan = subscriptionPlan
  const allowedKeysByPlan: Record<string, string[]> = {
    plan1: ['dashboard', 'pnl', 'daily_reports', 'reports', 'admin_users', 'employees'],
    plan2: [
      'dashboard', 'pnl', 'notifications', 'products', 'daily_reports',
      'approvals', 'inv_approvals', 'semis_verification', 'monthly', 'weekly',
      'reports', 'history', 'imported', 'admin_users', 'employees', 'schedule',
    ],
  }
  const isLimitedPlan = plan === 'plan1' || plan === 'plan2'
  const allowedForPlan = isLimitedPlan && plan ? new Set(allowedKeysByPlan[plan] ?? []) : null
  const isItemLocked = (key: string) =>
    isLimitedPlan && allowedForPlan ? !allowedForPlan.has(key) : false

  return (
    <aside className="fixed left-0 top-0 h-screen w-[216px] bg-white border-r border-[#E5E7EB] flex flex-col overflow-y-auto z-30">

      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-[#E5E7EB] shrink-0">
        <OneLinkLogo iconSize={22} textSize="text-[14px]" dark={false} />
        {subscriptionPlan && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#2563EB] uppercase tracking-wide">
            {subscriptionPlan}
          </span>
        )}
      </div>

      {/* User row */}
      <div className="px-5 py-3 border-b border-[#E5E7EB] shrink-0">
        <p className="text-[13px] font-medium text-[#111827] truncate">{adminName}</p>
        <p className="text-[11px] text-[#6B7280] mt-0.5">Administrator</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] px-3 pt-3 pb-1.5">
              {group.label}
            </p>
            {group.items.map(({ key, label, icon: Icon, badge }) => {
              const locked   = isItemLocked(key)
              const isActive = activeView === key || activeView.startsWith(key + '_')
              return (
                <button
                  key={key}
                  disabled={locked}
                  onClick={() => { if (!locked) onNavigate(key) }}
                  className={[
                    'relative w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-[13px] font-medium transition-colors duration-100',
                    isActive
                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                      : 'text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]',
                    locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#2563EB]" />
                  )}
                  <Icon className="w-[15px] h-[15px] shrink-0" />
                  <span className="truncate">{label}</span>
                  {locked && <Lock className="w-2.5 h-2.5 ml-auto text-[#9CA3AF]" />}
                  {!locked && badge !== undefined && badge > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold px-1">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-[#E5E7EB] shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-[13px] font-medium text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
        >
          <LogOut className="w-[15px] h-[15px] shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
