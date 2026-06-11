function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#EAEFF8] ${className}`} />
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-3">
        <Block className="h-72" />
        <Block className="h-44" />
      </div>

      <div className="space-y-5 xl:col-span-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Block className="h-40" />
          <Block className="h-40" />
          <Block className="h-40" />
          <Block className="h-40" />
        </div>
        <Block className="h-80" />
        <Block className="h-56" />
      </div>

      <div className="space-y-5 xl:col-span-3">
        <Block className="h-72" />
        <Block className="h-72" />
        <Block className="h-60" />
      </div>
    </div>
  )
}
