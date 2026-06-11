/* eslint-disable */
// @ts-nocheck
import { useEffect, useState } from 'react'
import { C } from '../../pages/dashboard/model/constants'
import MS from '../../../shared/ui/MaterialSymbol'
import { Spark } from './primitives'

function StatCard({ stat, delay }) {
  const up = stat.delta >= 0
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      className="relative cursor-default overflow-hidden rounded-[14px] border border-[#DDE3EE] bg-white px-[22px] py-5 transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      <div className="pointer-events-none absolute -top-5 -right-5 h-[100px] w-[100px] rounded-full" style={{ background: `radial-gradient(circle, ${stat.color}0F 0%, transparent 70%)` }} />

      <div className="mb-[14px] flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: stat.bg }}>
          <MS name={stat.icon} size={20} color={stat.color} />
        </div>
        <Spark data={stat.sparkline} color={stat.color} />
      </div>

      <div className="mb-1 flex items-end gap-1">
        <span className="text-[32px] leading-none font-extrabold tracking-[-0.04em] text-[#0A1628]">{stat.value}</span>
        {stat.unit ? <span className="pb-[3px] text-[13px] font-semibold text-[#8497B4]">{stat.unit}</span> : null}
      </div>

      <div className="mb-2.5 text-xs font-semibold text-[#374C6B]">{stat.label}</div>

      <div className="flex items-center gap-1.5 border-t border-[#EAEFF8] pt-2.5">
        <div className="flex items-center gap-1 rounded-md px-[7px] py-[3px]" style={{ background: up ? C.greenBg : C.redBg }}>
          <MS name={up ? 'arrow_upward' : 'arrow_downward'} size={11} color={up ? C.green : C.red} />
          <span className="text-[11px] font-bold" style={{ color: up ? C.green : C.red }}>
            {Math.abs(stat.delta)}%
          </span>
        </div>
        <span className="text-[11px] text-[#8497B4]">{stat.deltaLabel}</span>
      </div>
    </div>
  )
}

export default StatCard
