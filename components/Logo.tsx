'use client'
import { UtensilsCrossed } from 'lucide-react'

export const Logo = ({ className = "", textClassName = "" }: { className?: string, textClassName?: string }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      
      {/* STANDARD HTML IMG TAG (Bypasses the error) */}
      <img 
        src="/company-logo.png"  // <--- pointing to the NEW filename
        alt="Company Logo"
        className="w-10 h-10 object-contain"
        // If the image fails to load, this hides it and shows the icon
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const icon = document.getElementById('fallback-logo-icon');
          if (icon) icon.style.display = 'flex';
        }}
      />

      {/* FALLBACK ICON (Shows if image is missing) */}
      <div 
        id="fallback-logo-icon" 
        className="hidden bg-black text-white p-2 rounded-lg w-10 h-10 items-center justify-center"
      >
        <UtensilsCrossed size={20} />
      </div>
      
      {/* COMPANY NAME */}
      <span className={`font-extrabold text-xl tracking-tight leading-none ${textClassName}`}>
        AKAB<span className="font-normal opacity-70">Group</span>
      </span>
    </div>
  )
}