import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import type { BoardColumnViewModel } from '../../view-models/BoardViewModel'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import GradientAvatar from '../../../shared/ui/GradientAvatar'
import {
  KANBAN_TYPO,
} from './kanbanTheme'

interface BoardColumnCardProps {
  column: BoardColumnViewModel
  columnIndex?: number
  assigneeNamesById?: Map<number, string>
  assigneeAvatarsById?: Map<number, string>
  activeDragColumnId: string
  columnDropTargetId: string
  onColumnDrop: (targetColumnId: string) => void
  onColumnDragHover: (columnId: string) => void
  onColumnDragHoverLeave: () => void
  onTaskDrop: (targetColumnId: string) => void
  onTaskDragStart: (taskId: string, sourceColumnId: string) => void
  onTaskDragEnd: () => void
  onColumnDragStart: (columnId: string) => void
  onColumnDragEnd: () => void
  onTaskOpen: (taskId: string) => void
  onCreateTask: (columnId: string) => void
  onRenameColumn: (columnId: string, currentName: string, currentKey: string) => void
  onDeleteColumn: (columnId: string) => void
  canManageTasks?: boolean
  canManageColumn?: boolean
  isTaskDragging?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  isLoadingMore?: boolean
}

const toInitials = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function AssigneeAvatar({ id, fullName, avatarUrl }: { id: number; fullName?: string; avatarUrl?: string }) {
  const label = fullName?.trim() || `User ${id}`
  const initials = fullName ? toInitials(fullName) : String(id).slice(-2)

  return (
    <div title={label} className="shrink-0 flex items-center justify-center">
      <GradientAvatar
        initials={initials}
        src={avatarUrl}
        size={24}
        seed={id}
      />
    </div>
  )
}

function TaskThumbnail({ title }: { title: string }) {
  const t = title.toLowerCase()

  if (t.includes('dark mode') || t.includes('toggle')) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-[#F3F4F6]/55 border border-[#EBEEF2]/70 flex items-center justify-center mb-3" style={{ aspectRatio: '4/3' }}>
        <div className="w-[85%] bg-white rounded-xl border border-[#E5E7EB] shadow-[0_4px_12px_rgba(0,0,0,0.03)] h-[80%] overflow-hidden flex select-none relative">
          {/* Light side */}
          <div className="w-1/2 h-full bg-white p-2.5 flex flex-col gap-1.5 justify-center">
            <div className="h-1.5 w-8 bg-[#E2E8F0] rounded-sm" />
            <div className="h-3 w-12 bg-[#F1F5F9] rounded" />
            <div className="h-1 w-10 bg-[#F1F5F9] rounded-sm" />
          </div>
          {/* Dark side */}
          <div className="w-1/2 h-full bg-[#0B0F19] p-2.5 flex flex-col gap-1.5 justify-center border-l border-[#1E293B]">
            <div className="h-1.5 w-8 bg-[#1E293B] rounded-sm" />
            <div className="h-3 w-12 bg-[#1F2937] rounded" />
            <div className="h-1 w-10 bg-[#1F2937] rounded-sm" />
          </div>
          {/* Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center border border-[#E2E8F0]">
            <div className="text-[9px] text-[#94A3B8] font-bold tracking-tighter flex items-center gap-0.5 select-none">
              <span>&larr;</span><span>&rarr;</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (t.includes('landing page') || t.includes('landing') || t.includes('complete the text')) {
    return (
      <div className="w-full rounded-xl overflow-hidden bg-[#F3F4F6]/55 border border-[#EBEEF2]/70 flex items-center justify-center mb-3" style={{ aspectRatio: '4/3' }}>
        <div className="w-[85%] bg-white rounded-xl border border-[#E5E7EB] shadow-[0_4px_12px_rgba(0,0,0,0.03)] p-2.5 flex flex-col gap-2">
          {/* Header */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <div className="h-1.5 flex-1 bg-[#F1F5F9] rounded-md ml-1.5" />
          </div>
          {/* Content columns */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 shrink-0">
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-10 bg-[#E9D5FF] rounded-sm" />
              <div className="h-1 w-6 bg-[#F1F5F9] rounded-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-12 bg-[#E9D5FF] rounded-sm" />
              <div className="h-1 w-8 bg-[#F1F5F9] rounded-sm" />
            </div>
          </div>
          {/* Bottom container */}
          <div className="mt-1 h-12 w-full bg-[#F8FAFC] rounded-lg border border-[#F1F5F9] shadow-inner" />
        </div>
      </div>
    )
  }

  if (t.includes('onboarding') || t.includes('translate') || t.includes('spanish')) {
    return (
      <div className="w-full rounded-xl overflow-hidden bg-[#F3F4F6]/55 border border-[#EBEEF2]/70 flex items-center justify-center mb-3" style={{ aspectRatio: '4/3' }}>
        <div className="w-[85%] bg-white rounded-xl border border-[#E5E7EB] shadow-[0_4px_12px_rgba(0,0,0,0.03)] p-2.5 flex gap-2 h-[80%] overflow-hidden">
          {/* Sidebar */}
          <div className="w-4 shrink-0 bg-[#F1F5F9] rounded-md flex flex-col gap-1 p-1">
            <div className="h-1 bg-[#CBD5E1] rounded-sm" />
            <div className="h-1 bg-[#E2E8F0] rounded-sm" />
            <div className="h-1 bg-[#E2E8F0] rounded-sm" />
          </div>
          {/* Content */}
          <div className="flex-1 flex flex-col gap-2 justify-center">
            <div className="h-10 w-full rounded-lg bg-[#EEF2FF] border border-[#E0E7FF] p-1.5 flex flex-col gap-1 justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-[#F5F3FF]" />
              <div className="h-1.5 w-1/2 bg-[#C7D2FE] rounded-full" />
              <div className="h-1 w-2/3 bg-[#E2E8F0] rounded-full" />
              <svg className="absolute bottom-1 right-1.5 w-10 h-5" viewBox="0 0 100 50">
                <path d="M 0 40 Q 25 10, 50 30 T 100 10" fill="none" stroke="#6366F1" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex gap-1.5">
              <div className="h-1.5 w-8 bg-[#E2E8F0] rounded-full" />
              <div className="h-1.5 w-4 bg-[#E2E8F0] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function StackedAssignees({
  ids,
  assigneeNamesById,
  assigneeAvatarsById,
}: {
  ids: number[]
  assigneeNamesById?: Map<number, string>
  assigneeAvatarsById?: Map<number, string>
}) {
  if (!ids || ids.length === 0) return null

  const visibleIds = ids.slice(0, 4)
  const remainingCount = ids.length - 4

  return (
    <div className="flex -space-x-1.5 items-center shrink-0">
      {visibleIds.map((id) => (
        <div
          key={id}
          className="rounded-full ring-2 ring-white overflow-hidden bg-white shadow-sm flex items-center justify-center w-6 h-6 z-10 transition-all duration-150 hover:scale-105 hover:z-20"
        >
          <AssigneeAvatar
            id={id}
            fullName={assigneeNamesById?.get(id)}
            avatarUrl={assigneeAvatarsById?.get(id)}
          />
        </div>
      ))}
      {remainingCount > 0 ? (
        <div className="w-6 h-6 rounded-full bg-[#F1F5F9] ring-2 ring-white flex items-center justify-center text-[10px] font-semibold text-[#64748B] shadow-sm z-10 shrink-0">
          +{remainingCount}
        </div>
      ) : null}
    </div>
  )
}

function DateBadge({ dueAt, dueAtLabel }: { dueAt?: string; dueAtLabel?: string }) {
  const labelText = dueAtLabel?.trim() || 'Без срока'
  const label = labelText.toLowerCase()
  const isToday = label.includes('сегодня') || label.includes('today')
  const isTomorrow = label.includes('завтра') || label.includes('tomorrow')
  const isNoDeadline = label.includes('без срока') || label.includes('no due date') || !dueAt

  let badgeStyle = 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]/30'
  let calendarIconColor = '#64748B'

  if (isToday) {
    badgeStyle = 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]/30'
    calendarIconColor = '#D97706'
  } else if (isTomorrow) {
    badgeStyle = 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]/30'
    calendarIconColor = '#D97706'
  } else if (isNoDeadline) {
    badgeStyle = 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]/30'
    calendarIconColor = '#64748B'
  } else if (dueAt) {
    badgeStyle = 'bg-[#E8F8F0] text-[#0F8A50] border border-[#E8F8F0]'
    calendarIconColor = '#0F8A50'
  }

  const capitalizedLabel = labelText.charAt(0).toUpperCase() + labelText.slice(1)

  return (
    <div className={`px-2 py-0.5 rounded-[6px] text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 ${badgeStyle}`}>
      <MaterialSymbol name="calendar_today" size={12} color={calendarIconColor} />
      <span>{capitalizedLabel}</span>
    </div>
  )
}

function PriorityIconBadge({ priority }: { priority: string }) {
  const p = priority.trim().toLowerCase()
  let iconName = 'sprint'
  let bgColor = 'bg-[#3B82F6]' // Default medium blue
  let label = 'Средний'

  switch (p) {
    case 'critical':
    case 'urgent':
      iconName = 'bolt'
      bgColor = 'bg-[#EF4444]'
      label = 'Критический'
      break
    case 'high':
      iconName = 'arrow_upward'
      bgColor = 'bg-[#F97316]' // Orange
      label = 'Высокий'
      break
    case 'medium':
      iconName = 'sprint'
      bgColor = 'bg-[#3B82F6]' // Blue
      label = 'Средний'
      break
    case 'low':
      iconName = 'arrow_downward'
      bgColor = 'bg-[#10B981]' // Green
      label = 'Низкий'
      break
    default:
      iconName = 'sprint'
      bgColor = 'bg-[#3B82F6]'
      label = 'Средний'
      break
  }

  return (
    <span
      title={`Приоритет: ${label}`}
      className={`h-[18px] w-[18px] rounded-[5px] flex items-center justify-center shrink-0 text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${bgColor}`}
    >
      <MaterialSymbol name={iconName} size={11} color="white" />
    </span>
  )
}



function ColumnHeaderMenu({
  canManageColumn,
  onRename,
  onDelete,
}: {
  canManageColumn: boolean
  onRename: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!canManageColumn) return null

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#9CA3AF] transition hover:bg-white hover:text-[#4B5563] hover:shadow-[0_1px_2px_rgba(0,0,0,0.03)] border border-transparent hover:border-[#E5E7EB]"
        aria-label="Настройки колонки"
      >
        <MaterialSymbol name="more_horiz" size={18} color="currentColor" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-30 min-w-[160px] rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={() => {
              onRename()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
          >
            <MaterialSymbol name="edit" size={15} color="currentColor" />
            Переименовать
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
          >
            <MaterialSymbol name="delete" size={15} color="currentColor" />
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function BoardColumnCard({
  column,
  assigneeNamesById,
  assigneeAvatarsById,
  activeDragColumnId,
  columnDropTargetId,
  onColumnDrop,
  onColumnDragHover,
  onColumnDragHoverLeave,
  onTaskDrop,
  onTaskDragStart,
  onTaskDragEnd,
  onColumnDragStart,
  onColumnDragEnd,
  onTaskOpen,
  onCreateTask,
  onRenameColumn,
  onDeleteColumn,
  canManageTasks = true,
  canManageColumn = true,
  isTaskDragging = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: BoardColumnCardProps) {
  const [isTaskOver, setIsTaskOver] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const taskListRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const isColumnBeingDragged = activeDragColumnId === column.id
  const isColumnDropTarget =
    !!activeDragColumnId && !isColumnBeingDragged && columnDropTargetId === column.id

  const setupObserver = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      if (!node || !hasMore || isLoadingMore || !onLoadMore) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onLoadMore()
          }
        },
        {
          root: taskListRef.current,
          rootMargin: '100px',
          threshold: 0,
        },
      )
      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, onLoadMore],
  )

  return (
    <section
      ref={sectionRef}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (activeDragColumnId && !isColumnBeingDragged) {
          onColumnDragHover(column.id)
        }

        if (isTaskDragging && taskListRef.current) {
          const container = taskListRef.current
          const rect = container.getBoundingClientRect()
          const threshold = 100
          const scrollSpeed = 25

          if (event.clientY < rect.top + threshold) {
            container.scrollTop -= scrollSpeed
          } else if (event.clientY > rect.bottom - threshold) {
            container.scrollTop += scrollSpeed
          }
        }
      }}
      onDragLeave={() => {
        if (isColumnDropTarget) {
          onColumnDragHoverLeave()
        }
      }}
      onDrop={() => {
        onColumnDragHoverLeave()
        onColumnDrop(column.id)
      }}
      className={[
        'flex h-full max-h-full min-h-[400px] w-full flex-col rounded-2xl p-3.5 md:min-h-[480px] md:w-[280px] md:shrink-0 border border-[#EBEEF2]/60 shadow-[0_1px_3px_rgba(0,0,0,0.01)] transition-all duration-200',
        'transition-[opacity,box-shadow] duration-200',
        isColumnBeingDragged ? 'opacity-80' : '',
        isColumnDropTarget ? 'ring-2 ring-[#CBD5E1] ring-offset-2 ring-offset-[#F8F9FA]' : '',
        isTaskOver && isTaskDragging ? 'ring-2 ring-[#94A3B8]/50 ring-offset-2' : '',
      ].join(' ')}
      style={{ backgroundColor: '#F4F6F8' }}
    >
      <div
        className={`mb-3.5 flex shrink-0 items-center gap-2 ${canManageColumn ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={canManageColumn}
        onDragStart={
          canManageColumn
            ? (e: DragEvent) => {
                e.stopPropagation()
                e.dataTransfer.effectAllowed = 'move'
                if (sectionRef.current) {
                  const { width, height } = sectionRef.current.getBoundingClientRect()
                  e.dataTransfer.setDragImage(sectionRef.current, width / 2, Math.min(height / 2, 120))
                }
                onColumnDragStart(column.id)
              }
            : undefined
        }
        onDragEnd={onColumnDragEnd}
      >
        <h3 className="min-w-0 truncate text-[15px] font-bold tracking-tight text-[#1F2937]">{column.name}</h3>
        <span className="shrink-0 text-[11px] font-bold text-[#94A3B8] bg-white border border-[#EBEEF2] px-2 py-0.5 rounded-full min-w-[22px] text-center h-5 flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {column.totalTasks}
        </span>
        <span className="min-w-0 flex-1" />
        {canManageTasks ? (
          <button
            type="button"
            onClick={() => onCreateTask(column.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#64748B] bg-white border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition hover:bg-[#F8FAFC] hover:text-[#1E293B] cursor-pointer"
            aria-label={`Добавить задачу в ${column.name}`}
          >
            <MaterialSymbol name="add" size={16} color="currentColor" />
          </button>
        ) : null}
        <ColumnHeaderMenu
          canManageColumn={canManageColumn}
          onRename={() => onRenameColumn(column.id, column.name, column.key)}
          onDelete={() => onDeleteColumn(column.id)}
        />
      </div>

      <div
        ref={taskListRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain [scrollbar-color:rgba(0,0,0,0.06)_transparent] [scrollbar-width:thin]"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDragEnter={(e) => {
          if (isTaskDragging) {
            e.preventDefault()
            setIsTaskOver(true)
          }
        }}
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < rect.left ||
            e.clientX >= rect.right ||
            e.clientY < rect.top ||
            e.clientY >= rect.bottom
          ) {
            setIsTaskOver(false)
          }
        }}
        onDrop={() => {
          setIsTaskOver(false)
          onTaskDrop(column.id)
        }}
      >
        {isTaskOver && isTaskDragging ? (
          <div className="h-16 shrink-0 rounded-lg border-2 border-dashed border-[#CBD5E1] bg-white/60" />
        ) : null}

        {column.tasks.map((task) => {
          const taskKeyLabel = task.taskKey?.trim() || ''

          return (
            <button
              key={task.id}
              type="button"
              draggable
              onDragStart={(e) => {
                e.stopPropagation()
                e.dataTransfer.effectAllowed = 'move'
                const target = e.currentTarget as HTMLElement
                if (target) {
                  e.dataTransfer.setDragImage(target, 150, 40)
                }
                onTaskDragStart(task.id, column.id)
              }}
              onDragEnd={onTaskDragEnd}
              onClick={() => onTaskOpen(task.id)}
              aria-label={
                taskKeyLabel
                  ? `Открыть задачу ${taskKeyLabel}: ${task.title}`
                  : `Открыть задачу ${task.title}`
              }
              className="group flex w-full shrink-0 cursor-grab flex-col overflow-hidden rounded-2xl border border-[#EBEEF2] bg-white text-left shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.06)] transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5 p-3.5"
            >
              <TaskThumbnail title={task.title} />

              <div className="flex flex-wrap gap-1.5 mb-2.5 flex-row items-center w-full select-none">
                {task.labels &&
                  task.labels.map((label) => (
                    <span
                      key={label.id}
                      className="px-2.5 py-0.5 rounded-[6px] text-[11px] font-semibold text-white tracking-wide shrink-0"
                      style={{ backgroundColor: label.color || '#6B7280' }}
                    >
                      {label.name}
                    </span>
                  ))}

                <PriorityIconBadge priority={task.priority} />
                <span className="flex-1" />
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onTaskOpen(task.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      onTaskOpen(task.id)
                    }
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded text-[#C4C9D1] transition hover:bg-[#F3F4F6] hover:text-[#6B7280] opacity-0 group-hover:opacity-100 shrink-0"
                  aria-label="Меню задачи"
                >
                  <MaterialSymbol name="more_vert" size={16} color="currentColor" />
                </span>
              </div>

              {taskKeyLabel ? (
                <p
                  className={`mb-1 truncate text-left font-semibold tabular-nums ${KANBAN_TYPO.cardMeta} text-[#6B7280] select-none`}
                >
                  {taskKeyLabel}
                </p>
              ) : null}

              <p className="mb-2.5 text-[14px] font-bold text-[#1F2937] leading-[1.4] text-left tracking-tight line-clamp-3 select-none">
                {task.title}
              </p>

              <div className="mt-auto flex items-center justify-between gap-2 shrink-0 w-full">
                <DateBadge dueAt={task.dueAt} dueAtLabel={task.dueAtLabel} />
                <StackedAssignees
                  ids={task.assigneeIds}
                  assigneeNamesById={assigneeNamesById}
                  assigneeAvatarsById={assigneeAvatarsById}
                />
              </div>
            </button>
          )
        })}

        {hasMore ? (
          <div ref={setupObserver} className="flex h-10 shrink-0 items-center justify-center">
            {isLoadingMore ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#9CA3AF] border-t-transparent" />
            ) : null}
          </div>
        ) : null}
      </div>

      {canManageTasks ? (
        <button
          type="button"
          onClick={() => onCreateTask(column.id)}
          className={`mt-2 inline-flex w-full shrink-0 items-center gap-1.5 py-1.5 transition hover:text-[#6B7280] ${KANBAN_TYPO.addTaskLink}`}
        >
          <MaterialSymbol name="add" size={16} color="currentColor" />
          Добавить задачу
        </button>
      ) : null}
    </section>
  )
}
