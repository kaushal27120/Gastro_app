'use client'

import { OneLinkLogo } from "@/components/onelink-logo";
import { LayoutDashboard, FileText, ClipboardList, LogOut, MapPin, Calendar, Users } from 'lucide-react'

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
    { key: 'reporting',  label: 'Raport dzienny',  icon: LayoutDashboard },
    { key: 'invoices',   label: 'Faktury',          icon: FileText },
    { key: 'inventory',  label: 'Inwentaryzacja',   icon: ClipboardList },
    { key: 'scheduling', label: 'Harmonogram',      icon: Calendar },
    { key: 'employees',  label: 'Pracownicy',       icon: Users },
  ]

  return (
    <aside className="fixed left-0 top-0 h-screen w-[216px] bg-white border-r border-[#E5E7EB] flex flex-col z-30">

      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-[#E5E7EB] shrink-0">
        <OneLinkLogo iconSize={22} textSize="text-[14px]" dark={false} />
      </div>

      {/* Location switcher */}
      <button
        onClick={onSwitchLocation}
        className="flex items-center gap-2 px-5 py-3 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors text-left w-full shrink-0"
      >
        <MapPin className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Lokal</p>
          <p className="text-[13px] font-medium text-[#111827] truncate max-w-[140px]">{locationName}</p>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] px-3 pb-1.5">
          Menu
        </p>
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeView === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={[
                'relative w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-[13px] font-medium transition-colors duration-100 cursor-pointer',
                isActive
                  ? 'bg-[#EFF6FF] text-[#2563EB]'
                  : 'text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]',
              ].join(' ')}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#2563EB]" />
              )}
              <Icon className="w-[15px] h-[15px] shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
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
