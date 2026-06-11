import { useState } from 'react'
import CardShell from '../../../shared/ui/CardShell'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'

interface ServiceItem {
  id: number
  link: string
  icon: string
  label: string
  count: string
  color: string
  appPhoto: string | null
}

interface ServicesPanelProps {
  services?: ServiceItem[]
  onManage?: () => void
  onOpenService?: (service: ServiceItem) => void
}

export default function ServicesPanel({ services = [], onManage, onOpenService }: ServicesPanelProps) {
  const [brokenIds, setBrokenIds] = useState<Record<number, boolean>>({})

  return (
    <CardShell className="overflow-hidden border-0 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-extrabold tracking-tight text-[#0A1628]">Избранные сервисы</h3>
        <button
          type="button"
          onClick={onManage}
          className="text-[13px] font-bold text-blue-600 transition-colors hover:text-blue-700"
        >
          Управлять
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-3">
        {services.slice(0, 6).map((service) => {
          const hasPhoto = Boolean(service.appPhoto) && !brokenIds[service.id]

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onOpenService?.(service)}
              className="group flex flex-col items-center gap-3 rounded-xl border-0 bg-white px-2 py-4 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[10px] shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105" style={{ backgroundColor: `${service.color}15` }}>
                {hasPhoto ? (
                  <img
                    src={service.appPhoto ?? ''}
                    alt={service.label}
                    className="h-11 w-11 object-cover"
                    loading="lazy"
                    onError={() => setBrokenIds((prev) => ({ ...prev, [service.id]: true }))}
                  />
                ) : (
                  <MaterialSymbol name={service.icon} size={20} color={service.color} />
                )}
              </span>
              <div className="text-center w-full">
                <span className="block truncate text-[12px] font-bold text-[#0A1628] leading-tight">{service.label}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">{service.count}</span>
              </div>
            </button>
          )
        })}

        {services.length === 0 ? (
          <p className="col-span-3 rounded-xl border-0 bg-slate-50 px-4 py-8 text-center text-[13px] font-medium text-slate-500 shadow-inner ring-1 ring-black/5">
            Нет избранных сервисов
          </p>
        ) : null}
      </div>
    </CardShell>
  )
}
