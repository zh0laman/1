import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { createAuthController } from '../auth/createAuthController'

interface PublicOnlyRouteProps {
  children?: ReactNode
}

export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { authController } = useMemo(() => createAuthController(), [])
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    let isCancelled = false

    authController
      .bootstrap()
      .then((model) => {
        if (!isCancelled) {
          setIsAuthenticated(model.isAuthenticated)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsChecking(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [authController])

  if (isChecking) {
    return (
      <main className="min-h-screen w-full grid place-items-center px-4 py-6">
        <section className="w-full max-w-115 rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_20px_rgba(17,24,39,0.06)]">
          <h1 className="m-0 text-[28px] font-bold text-[#1c1c1e]">Загрузка...</h1>
        </section>
      </main>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/main/dashboard" replace />
  }

  return children ?? <Outlet />
}
