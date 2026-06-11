function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-[#F3F4F6]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-[#F3F4F6]" />
          <div className="h-3 w-1/2 rounded bg-[#F3F4F6]" />
        </div>
      </div>
      <div className="mb-3 flex gap-3">
        <div className="h-3 w-16 rounded bg-[#F3F4F6]" />
        <div className="h-3 w-10 rounded bg-[#F3F4F6]" />
      </div>
      <div className="h-6 w-20 rounded-full bg-[#F3F4F6]" />
    </div>
  )
}

function WorkdaySkeleton() {
  return (
    <div className="animate-pulse rounded-[20px] border border-[#E5E7EB] bg-[#FAFBFC] p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="h-6 w-32 rounded-full bg-[#E5E7EB]" />
        <div className="h-6 w-48 rounded-full bg-[#E5E7EB]" />
        <div className="h-6 w-28 rounded-full bg-[#E5E7EB]" />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[220px] rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <div className="mb-3 h-4 w-24 rounded bg-[#F3F4F6]" />
            <div className="space-y-2">
              <div className="h-10 rounded-xl bg-[#F9FAFB]" />
              <div className="h-10 rounded-xl bg-[#F9FAFB]" />
              <div className="h-10 rounded-xl bg-[#F9FAFB]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WorkspaceSkeletons() {
  return (
    <div className="space-y-8">
      <WorkdaySkeleton />
      <div>
        <div className="mb-3 h-6 w-56 rounded bg-[#E5E7EB]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
