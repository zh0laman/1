import React from 'react'

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  isLoading?: boolean
}

export default function AppButton({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  ...props 
}: AppButtonProps) {
  const base = "h-10 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    primary: "bg-[#1E88E5] text-white hover:bg-[#1878CA] shadow-[0_4px_12px_rgba(30,136,229,0.25)]",
    secondary: "bg-white border border-[#DDE3EE] text-[#374C6B] hover:bg-[#F9FAFB]",
    danger: "bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-[0_4px_12px_rgba(239,68,68,0.25)]"
  }
  
  return (
    <button 
      className={`${base} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
