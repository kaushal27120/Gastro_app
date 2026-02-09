'use client'
import { FileText, Receipt, Users, LogOut, MapPin } from 'lucide-react'
import { Logo } from '@/components/Logo' // <--- Import

type OpsSidebarProps = {
  locationName: string;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onSwitchLocation: () => void;
}

export function OpsSidebar({ locationName, activeView, onNavigate, onLogout, onSwitchLocation }: OpsSidebarProps) {
  const menuItems = [
    { id: 'reporting', name: 'Daily Reporting', icon: FileText },
    { id: 'invoices', name: 'Invoices & Costs', icon: Receipt },
    // { id: 'staffing', name: 'Staffing', icon: Users }, // Hidden per previous request
  ]

  return (
    <div className="w-64 min-h-screen bg-white border-r border-gray-200 fixed left-0 top-0 flex flex-col z-10">
      {/* HEADER */}
      <div className="p-6 border-b border-gray-100">
        <Logo textClassName="text-slate-900" />
        
        <div className="flex items-center gap-2 mt-4 text-sm text-gray-500 cursor-pointer hover:text-blue-600 bg-gray-50 p-2 rounded" onClick={onSwitchLocation}>
          <MapPin className="w-4 h-4" />
          <span className="truncate max-w-[140px] font-medium">{locationName}</span>
        </div>
      </div>

      {/* MENU */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <div 
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium cursor-pointer transition-colors
              ${activeView === item.id
                ? 'bg-gray-900 text-white shadow-md' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </div>
        ))}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-gray-100">
        <div onClick={onLogout} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md cursor-pointer">
          <LogOut className="w-5 h-5" />
          Log Out
        </div>
      </div>
    </div>
  )
}