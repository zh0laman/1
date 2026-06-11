import { useMemo } from 'react'
import CardShell from '../../../shared/ui/CardShell'

interface ActivityPanelProps {
  taskCount: number
}

const buildSeries = (base: number, variance: number) => {
  const normalized = Math.max(1, base)
  return [
    Math.max(1, Math.round(normalized * 0.42) + variance),
    Math.max(1, Math.round(normalized * 0.58) - variance),
    Math.max(1, Math.round(normalized * 0.5) + variance),
    Math.max(1, Math.round(normalized * 0.75)),
    Math.max(1, Math.round(normalized * 0.66) - variance),
    Math.max(1, Math.round(normalized * 0.83) + variance),
    Math.max(1, Math.round(normalized * 0.62)),
  ]
}

const pointsToPath = (points: number[], width: number, height: number) => {
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const stepX = width / (points.length - 1)
  const normalizeY = (value: number) => {
    if (max === min) return height / 2
    return height - ((value - min) / (max - min)) * (height - 8) - 4
  }

  return points
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * stepX} ${normalizeY(value)}`)
    .join(' ')
}

export default function ActivityPanel({ taskCount }: ActivityPanelProps) {
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  const completed = useMemo(() => buildSeries(taskCount, 1), [taskCount])
  const inProgress = useMemo(() => buildSeries(taskCount + 2, -1), [taskCount])

  const completedPath = useMemo(() => pointsToPath(completed, 100, 40), [completed])
  const inProgressPath = useMemo(() => pointsToPath(inProgress, 100, 40), [inProgress])

  return (
    <CardShell className="overflow-hidden border-0 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-base font-extrabold tracking-tight text-[#0A1628]">Активность задач</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-[#64748B]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1E88E5]" />
              В работе
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0A8F5C]" />
              Завершённые
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border-0 bg-[#F8FAFC] p-5 shadow-inner ring-1 ring-black/5">
        <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold text-[#94A3B8]">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="relative h-40">
          <div className="absolute inset-0 grid grid-rows-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border-t border-[#EEF2F8]" />
            ))}
          </div>

          <div className="absolute inset-0 grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="border-l border-[#F3F5FA] first:border-l-0" />
            ))}
          </div>

          <svg viewBox="0 0 100 40" className="absolute inset-0 h-full w-full">
            <path d={inProgressPath} fill="none" stroke="#1E88E5" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
            <path d={completedPath} fill="none" stroke="#0A8F5C" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
    </CardShell>
  )
}
