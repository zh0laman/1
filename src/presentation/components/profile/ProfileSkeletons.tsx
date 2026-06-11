function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#E5E7EB] ${className}`} />
}

export default function ProfileSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <Block className="h-24 w-full rounded-none" />
          <div className="space-y-3 p-5 pt-12">
            <Block className="h-5 w-40" />
            <Block className="h-4 w-28" />
            <Block className="h-8 w-full" />
            <Block className="h-20 w-full" />
          </div>
        </div>
      </div>
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <Block className="mb-4 h-5 w-56" />
          <div className="grid grid-cols-2 gap-3">
            <Block className="h-20" />
            <Block className="h-20" />
          </div>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <Block className="mb-4 h-5 w-64" />
          <Block className="h-24 w-full" />
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <Block className="mb-4 h-5 w-48" />
          <Block className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}
