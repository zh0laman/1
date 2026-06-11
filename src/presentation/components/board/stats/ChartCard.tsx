import React from 'react'

interface ChartCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function ChartCard({ title, children, className = '' }: ChartCardProps) {
  return (
    <div className={`flex min-w-0 flex-col rounded-2xl border border-[#DDE3EE] bg-white p-5 shadow-sm transition-all hover:shadow-md ${className}`}>
      <h3 className="mb-4 text-sm font-bold text-[#0A1628] uppercase tracking-tight">{title}</h3>
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}
