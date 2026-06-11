function SkeletonBox({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#EAEFF8] ${className}`} />
}

export default function CalendarSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-2xl border border-[#DDE3EE] bg-white p-4">
          <SkeletonBox className="mb-4 h-8 w-48" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }).map((_, index) => (
              <SkeletonBox key={index} className="h-[72px]" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4 xl:col-span-4">
        <div className="rounded-2xl border border-[#DDE3EE] bg-white p-4">
          <SkeletonBox className="mb-3 h-6 w-36" />
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBox key={index} className="mb-2 h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
