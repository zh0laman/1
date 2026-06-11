import MaterialSymbol from '../../../../shared/ui/MaterialSymbol'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  icon: string
  color: string
}

export function StatCard({ label, value, subValue, icon, color }: StatCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-[#DDE3EE] bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 mb-2">
        <MaterialSymbol name={icon} size={16} color={color} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-extrabold text-[#0A1628]">{value}</span>
        {subValue && <span className="text-xs font-bold text-[#10B981]">{subValue}</span>}
      </div>
    </div>
  )
}
