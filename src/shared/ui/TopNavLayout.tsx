import { Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

interface TopNavLayoutProps {
  topNav: ReactNode
  background?: string
  fontFamily?: string
  outletContext?: unknown
}

export default function TopNavLayout({
  topNav,
  background = '#EDF0F7',
  fontFamily = "'Inter', sans-serif",
  outletContext,
}: TopNavLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background, fontFamily, overflow: 'hidden' }}>
      {topNav}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/*
          Прокрутка здесь, а не на каждой странице: контент растёт по высоте, область под шапкой
          остаётся с фиксированной высотой (100vh − nav), появляется стандартный вертикальный скролл.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto overscroll-y-contain">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  )
}
