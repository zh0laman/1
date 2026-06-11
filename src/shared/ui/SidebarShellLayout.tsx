import { Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

interface SidebarShellLayoutProps {
  background: string
  fontFamily: string
  sidebar: ReactNode
  sidebarWidth: number
  outletContext?: unknown
}

export default function SidebarShellLayout({
  background,
  fontFamily,
  sidebar,
  sidebarWidth,
  outletContext,
}: SidebarShellLayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background, fontFamily }}>
      {sidebar}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 0.24s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Outlet context={outletContext} />
      </div>
    </div>
  )
}
