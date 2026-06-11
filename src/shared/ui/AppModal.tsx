import React from 'react'
import MaterialSymbol from './MaterialSymbol'

interface AppModalProps {
  title: string
  children: React.ReactNode
  onClose: () => void
  maxWidth?: number
}

export default function AppModal({ title, children, onClose, maxWidth = 500 }: AppModalProps) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0A1628]/45 p-4 backdrop-blur-sm">
      <div 
        className="w-full rounded-2xl border border-[#DDE3EE] bg-white shadow-[0_24px_70px_rgba(10,22,40,0.3)] overflow-hidden"
        style={{ maxWidth }}
      >
        <div className="flex items-center justify-between border-b border-[#F1F4F9] px-5 py-4">
          <h3 className="text-base font-bold text-[#0A1628]">{title}</h3>
          <button 
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8497B4] hover:bg-[#F1F5F9] transition"
          >
            <MaterialSymbol name="close" size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto custom-scrollbar" style={{ maxHeight: '80vh' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
