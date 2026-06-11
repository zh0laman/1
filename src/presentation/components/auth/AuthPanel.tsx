import type { AuthViewModel } from '../../view-models/AuthViewModel'

interface AuthPanelProps {
  model: AuthViewModel
  refreshing: boolean
  onRefresh: () => Promise<void>
  onLogout: () => void
}

export function AuthPanel({ model, refreshing, onRefresh, onLogout }: AuthPanelProps) {
  return (
    <section className="w-full max-w-115 rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_20px_rgba(17,24,39,0.06)]">
      <h1 className="m-0 text-[28px] font-bold text-[#1c1c1e]">Session Active</h1>
      <p className="mt-2 mb-5 text-sm text-[#6b7280]">{model.name || model.email || 'Authenticated user'}</p>

      <dl className="m-0 grid gap-2">
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f3f4f6] p-3">
          <dt className="text-xs text-[#6b7280]">Email</dt>
          <dd className="mt-1 text-[15px] font-medium text-[#1c1c1e]">{model.email || 'N/A'}</dd>
        </div>
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f3f4f6] p-3">
          <dt className="text-xs text-[#6b7280]">Access token expires in</dt>
          <dd className="mt-1 text-[15px] font-medium text-[#1c1c1e]">{model.expiresInSeconds}s</dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <button
          className="min-h-11 flex-1 rounded-xl border border-[#e5e7eb] bg-white px-4 text-base font-semibold text-[#1c1c1e] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-65"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh token'}
        </button>
        <button
          className="min-h-11 flex-1 rounded-xl border-0 bg-[#1e88e5] px-4 text-base font-semibold text-white hover:bg-[#082ea8]"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </section>
  )
}
