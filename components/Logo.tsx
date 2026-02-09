import Image from 'next/image'

export const Logo = ({ className = "", textClassName = "" }: { className?: string, textClassName?: string }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* LOGO IMAGE */}
      <div className="relative w-10 h-10">
        <Image 
          src="/logo.png" // Path to your file in public folder
          alt="Company Logo"
          fill // Auto-fill container
          className="object-contain" // Keep aspect ratio
        />
      </div>
      
      {/* COMPANY NAME (Optional - you can remove this if logo has text) */}
      <span className={`font-extrabold text-xl tracking-tight leading-none ${textClassName}`}>
        AKAB<span className="font-normal opacity-70">Group</span>
      </span>
    </div>
  )
}