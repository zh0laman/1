import { KANBAN_COLUMN_BG } from './kanbanTheme'

const COLUMN_COUNT = 5

export default function BoardSkeleton() {
  return (
    <div className="flex h-full gap-3 overflow-hidden md:gap-3">
      {Array.from({ length: COLUMN_COUNT }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="flex w-full shrink-0 flex-col rounded-xl p-3 md:w-[272px]"
          style={{ backgroundColor: KANBAN_COLUMN_BG }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-[#E5E7EB]" />
            <div className="h-4 w-4 animate-pulse rounded bg-[#E5E7EB]" />
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: colIdx === 4 ? 4 : 2 }).map((__, taskIdx) => (
              <div
                key={taskIdx}
                className="shrink-0 overflow-hidden rounded-xl border border-[#E8EAED] border-l-4 border-l-[#E5E7EB] bg-white p-3 shadow-sm"
              >
                <div className="mb-2 flex justify-between">
                  <div className="h-3 w-12 animate-pulse rounded bg-[#F3F4F6]" />
                  <div className="h-3 w-10 animate-pulse rounded bg-[#F3F4F6]" />
                </div>
                <div className="mb-3 h-4 w-full animate-pulse rounded bg-[#EEEEEE]" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 animate-pulse rounded bg-[#F5F5F5]" />
                  <div className="h-7 w-7 animate-pulse rounded-full bg-[#EEEEEE]" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-[#E5E7EB]" />
        </div>
      ))}
    </div>
  )
}
