import type { AppInfoViewModel } from '../view-models/AppInfoViewModel'

interface AppInfoCardProps {
  data: AppInfoViewModel
}

export function AppInfoCard({ data }: AppInfoCardProps) {
  return (
    <section className="card">
      <h1>{data.title}</h1>
      <p>{data.subtitle}</p>
      <span className={data.statusClassName}>{data.statusText}</span>
    </section>
  )
}
