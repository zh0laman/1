function SkeletonHero() {
  return (
    <div className="mb-10 animate-pulse">
      <div className="mb-4 h-7 w-48 rounded-lg bg-[#E4EBF6]" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-[280px] rounded-[24px] bg-[linear-gradient(135deg,#E4EBF6_0%,#EEF2F8_100%)] lg:col-span-7" />
        <div className="flex flex-col gap-3 lg:col-span-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex h-[88px] items-center gap-3 rounded-2xl border border-[#E8EEF4] bg-white p-3">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-[#E8EFF8]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-[#E8EFF8]" />
                <div className="h-3 w-1/3 rounded bg-[#EEF2F8]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkeletonGridCard() {
  return (
    <div className="flex min-h-[118px] gap-2.5 rounded-xl border border-[#E8ECF4] bg-white p-3 shadow-sm">
      <div className="h-[52px] w-[52px] shrink-0 rounded-[10px] bg-[#E8EFF8]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <div className="h-3.5 w-4/5 rounded bg-[#E8EFF8]" />
        <div className="h-3 w-1/2 rounded bg-[#EEF2F8]" />
        <div className="mt-auto h-5 w-24 rounded bg-[#F0F4FA]" />
      </div>
      <div className="flex w-14 flex-col justify-end">
        <div className="h-8 w-full rounded-lg bg-[#E8EFF8]" />
      </div>
    </div>
  )
}

function SkeletonCatalogSection() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-48 rounded bg-[#E4EBF6]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonGridCard key={index} />
        ))}
      </div>
    </div>
  )
}

export default function AlemStoreSkeletons() {
  return (
    <div className="space-y-8">
      <SkeletonHero />
      <div className="h-6 w-56 rounded bg-[#E4EBF6]" />
      <SkeletonCatalogSection />
      <SkeletonCatalogSection />
    </div>
  )
}
