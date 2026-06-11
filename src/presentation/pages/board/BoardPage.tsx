import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { BoardTask } from '../../../domain/entities/board/BoardModels'
import type { TzAiTaskAssistResponse, KanbanBoardStatsResponse } from '../../../domain/entities/AiTools'

import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import AppToast from '../../../shared/ui/AppToast'
import { getErrorMessage } from '../../../shared/utils/getErrorMessage'
import { createBoardController } from '../../board/createBoardController'
import { createAuthController } from '../../auth/createAuthController'
import BoardAdvancedPanel from '../../components/board/BoardAdvancedPanel'
import BoardColumnCard from '../../components/board/BoardColumnCard'
import BoardFilters from '../../components/board/BoardFilters'
import BoardHeader from '../../components/board/BoardHeader'
import BoardMembersModal from '../../components/board/BoardMembersModal'
import BoardSkeleton from '../../components/board/BoardSkeleton'
import CreateBoardModal from '../../components/board/CreateBoardModal'
import CreateSprintModal from '../../components/board/CreateSprintModal'
import CreateTaskModal from '../../components/board/CreateTaskModal'
import GoalFormModal from '../../components/board/GoalFormModal'
import ProjectFormModal from '../../components/board/ProjectFormModal'
import AiTaskAssistModal from '../../components/board/AiTaskAssistModal'
import TaskDetailModal from '../../components/board/TaskDetailModal'
import BoardPickerGrid from '../../components/board/BoardPickerGrid'
import BoardToolsMenu from '../../components/board/BoardToolsMenu'
import { KANBAN_PAGE_BG } from '../../components/board/kanbanTheme'
import BoardStatsDashboard from '../../components/board/BoardStatsDashboard'
import MultiBoardStatsModal from '../../components/board/MultiBoardStatsModal'
import MultiBoardStatsSection from '../../components/board/MultiBoardStatsSection'
import SingleBoardAiStatsSection from '../../components/board/SingleBoardAiStatsSection'
import { AlemAIUploadModal } from '../../components/board/AlemAIUploadModal'
import { AlemAIGeneratedTasks } from '../../components/board/AlemAIGeneratedTasks'
import AppConfirmDialog from '../../../shared/ui/AppConfirmDialog'
import CreateColumnModal from '../../components/board/CreateColumnModal'
import AppPromptDialog from '../../../shared/ui/AppPromptDialog'
import { createAlemAiController } from '../../alem-ai/createAlemAiController'
import type { TzAiTaskItem } from '../alemai/tzai/types'
import type {
  BoardActivityViewModel,
  BoardCommentViewModel,
  BoardDetailsViewModel,
  BoardLabelViewModel,
  BoardOptionViewModel,
  BoardUserViewModel,
  BoardStatsViewModel,
} from '../../view-models/BoardViewModel'

const LAST_BOARD_KEY = 'superapp.last_board_id'
const BOARD_VISIT_IDS_KEY = 'superapp.board_visit_ids'
const SPRINT_LINK_OVERRIDES_KEY_PREFIX = 'superapp.board_sprint_links.'

type SprintLinkOverride = {
  goalId?: string
  projectId?: string
}

const getSprintLinkOverridesStorageKey = (boardId: string) => `${SPRINT_LINK_OVERRIDES_KEY_PREFIX}${boardId}`

const readSprintLinkOverrides = (boardId: string): Record<string, SprintLinkOverride> => {
  try {
    const raw = window.localStorage.getItem(getSprintLinkOverridesStorageKey(boardId))
    if (!raw) return {}

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([sprintId, value]) => {
        if (!value || typeof value !== 'object') return []

        const nextValue = value as { goalId?: unknown; projectId?: unknown }
        const goalId = typeof nextValue.goalId === 'string' ? nextValue.goalId : undefined
        const projectId = typeof nextValue.projectId === 'string' ? nextValue.projectId : undefined

        if (!goalId && !projectId) return []
        return [[sprintId, { goalId, projectId }]]
      }),
    )
  } catch {
    return {}
  }
}

const writeSprintLinkOverrides = (boardId: string, overrides: Record<string, SprintLinkOverride>) => {
  try {
    if (Object.keys(overrides).length === 0) {
      window.localStorage.removeItem(getSprintLinkOverridesStorageKey(boardId))
      return
    }

    window.localStorage.setItem(getSprintLinkOverridesStorageKey(boardId), JSON.stringify(overrides))
  } catch {
    // Ignore storage sync failures.
  }
}

const applySprintLinkOverrides = (
  details: BoardDetailsViewModel,
  overrides: Record<string, SprintLinkOverride>,
): BoardDetailsViewModel => {
  if (Object.keys(overrides).length === 0) return details

  let hasChanges = false
  const sprints = details.sprints.map((sprint) => {
    const override = overrides[sprint.id]
    if (!override) return sprint

    const nextGoalId = sprint.goalId || override.goalId
    const nextProjectId = sprint.projectId || override.projectId
    if (nextGoalId === sprint.goalId && nextProjectId === sprint.projectId) {
      return sprint
    }

    hasChanges = true
    return {
      ...sprint,
      goalId: nextGoalId,
      projectId: nextProjectId,
    }
  })

  return hasChanges ? { ...details, sprints } : details
}

const getSprintStatusMeta = (status: string) => {
  if (status === 'active') {
    return { label: 'Активен', className: 'bg-green-100 text-green-800' }
  }

  if (status === 'planned') {
    return { label: 'Запланирован', className: 'bg-gray-100 text-gray-800' }
  }

  return { label: 'Завершен', className: 'bg-slate-200 text-slate-700' }
}

const pushBoardVisitId = (boardId: string) => {
  try {
    const raw = window.localStorage.getItem(BOARD_VISIT_IDS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    const prev = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    const next = [boardId, ...prev.filter((id) => id !== boardId)].slice(0, 24)
    window.localStorage.setItem(BOARD_VISIT_IDS_KEY, JSON.stringify(next))
  } catch {
    window.localStorage.setItem(BOARD_VISIT_IDS_KEY, JSON.stringify([boardId]))
  }
}

const PRESET_HEX_MAP: Record<string, string> = {
  preset_default: '#F4F5F7',
  preset_mint: '#EAF7F2',
  preset_sand: '#FFF3E8',
  preset_sky: '#EAF3FF',
}

const GOAL_CARD_TONES = [
  {
    shell: 'border-[#D9E7FB] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFF_100%)]',
    badge: 'bg-[#EBF4FE] text-[#1E88E5]',
    accent: '#1E88E5',
    accentTrack: 'bg-[#EAF4FF]',
    status: 'bg-[#E8F7EE] text-[#1F8F5F]',
  },
  {
    shell: 'border-[#D7F0EA] bg-[linear-gradient(180deg,#FFFFFF_0%,#F5FCFA_100%)]',
    badge: 'bg-[#E0F2F1] text-[#00897B]',
    accent: '#00A896',
    accentTrack: 'bg-[#E8FBF7]',
    status: 'bg-[#E6F7F4] text-[#0C7B70]',
  },
  {
    shell: 'border-[#E7E2FB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF8FF_100%)]',
    badge: 'bg-[#F1ECFE] text-[#6E59CF]',
    accent: '#7C5CFA',
    accentTrack: 'bg-[#F3EEFF]',
    status: 'bg-[#EFEAFE] text-[#6750C9]',
  },
] as const

interface BoardRouteState {
  boardId?: string
  taskId?: string
}

const buildBoardUrl = (boardId?: string, taskId?: string) => {
  const params = new URLSearchParams()
  const normalizedBoardId = boardId?.trim()
  const normalizedTaskId = taskId?.trim()

  if (normalizedBoardId) {
    params.set('boardId', normalizedBoardId)
  }

  if (normalizedTaskId) {
    params.set('task', normalizedTaskId)
  }

  const search = params.toString()
  return search ? `/board?${search}` : '/board'
}

const defaultTaskForm = {
  title: '',
  description: '',
  priority: 'medium' as BoardTask['priority'],
  sprintId: '',
  goalId: '',
  projectId: '',
  dueAt: '',
  assigneeIds: [] as number[],
  labelIds: [] as string[],
  parentId: '',
  attachmentFileIds: [] as string[],
}

const moveArrayItem = <T,>(array: T[], from: number, to: number): T[] => {
  const next = array.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

const normalizeStatusKey = (key?: string): string => {
  if (!key) return ''
  const k = key.toUpperCase().trim()
  if (['TODO', 'TO DO', 'К ВЫПОЛНЕНИЮ', 'К_ВЫПОЛНЕНИЮ'].includes(k)) return 'TODO'
  if (['IN_PROGRESS', 'IN PROGRESS', 'В РАБОТЕ', 'В_РАБОТЕ'].includes(k)) return 'IN_PROGRESS'
  if (['TEST', 'НА ПРОВЕРКЕ', 'НА_ПРОВЕРКЕ'].includes(k)) return 'TEST'
  if (['DONE', 'ГОТОВО', 'ЗАВЕРШЕНО', 'ЗАВЕРШЕН'].includes(k)) return 'DONE'
  return k
}

const statusLabelToKey = (label?: string): string => {
  if (!label) return ''
  const l = label.trim()
  const map: Record<string, string> = {
    'К выполнению': 'TODO',
    'В работе': 'IN_PROGRESS',
    'На проверке': 'TEST',
    'Готово': 'DONE',
    'К ВЫПОЛНЕНИЮ': 'TODO',
    'В РАБОТЕ': 'IN_PROGRESS',
    'НА ПРОВЕРКЕ': 'TEST',
    'ГОТОВО': 'DONE',
  }
  return map[l] || l
}

export default function BoardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { boardController } = useMemo(() => createBoardController(), [])
  const { authController } = useMemo(() => createAuthController(), [])
  const { alemAiRepository } = useMemo(() => createAlemAiController(), [])
  const routeState = (location.state as BoardRouteState | null) ?? null
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedBoardId =
    searchParams.get('boardId')?.trim() ||
    (typeof routeState?.boardId === 'string' ? routeState.boardId.trim() : '')
  const requestedTaskId =
    searchParams.get('task')?.trim() ||
    searchParams.get('taskId')?.trim() ||
    (typeof routeState?.taskId === 'string' ? routeState.taskId.trim() : '')
  const skipBoardPicker = Boolean(requestedBoardId)
  const pendingRequestedTaskIdRef = useRef(requestedTaskId)

  const [boards, setBoards] = useState<BoardOptionViewModel[]>([])
  const [boardProgressById, setBoardProgressById] = useState<Record<string, number>>({})
  const [boardMembersById, setBoardMembersById] = useState<Record<string, Array<{ initials: string; name: string; avatarUrl?: string }>>>({})
  const [boardView, setBoardView] = useState<'picker' | 'kanban'>(() => (skipBoardPicker ? 'kanban' : 'picker'))
  const [pickerTab, setPickerTab] = useState<'boards' | 'ai' | 'stats'>('boards')
  const [users, setUsers] = useState<BoardUserViewModel[]>([])
  const [boardDetails, setBoardDetails] = useState<BoardDetailsViewModel | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [selectedSprintId, setSelectedSprintId] = useState('')
  const [search, setSearch] = useState('')
  const [filterUserId, setFilterUserId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterLabelId, setFilterLabelId] = useState('')
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({})
  const [columnLoadingMore, setColumnLoadingMore] = useState<Record<string, boolean>>({})
  const [columnHasMore, setColumnHasMore] = useState<Record<string, boolean>>({})

  const [isBootstrapLoading, setIsBootstrapLoading] = useState(true)
  const [isBoardLoading, setIsBoardLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const setApiError = useCallback((err: unknown, fallback: string) => {
    setError(getErrorMessage(err, fallback))
  }, [])

  const handleLoadAttachment = useCallback((url: string) => {
    return boardController.downloadAttachmentByUrl(url)
  }, [boardController])

  // handleAttachmentDelete logic (commented out due to redundancy/mojibake)
  const [dragColumnId, setDragColumnId] = useState('')
  const [columnDropTargetId, setColumnDropTargetId] = useState('')
  const [dragTaskState, setDragTaskState] = useState<{ taskId: string; sourceColumnId: string } | null>(null)
  const columnRefs = useRef(new Map<string, HTMLDivElement>())
  const mainContainerRef = useRef<HTMLElement | null>(null)
  const columnsScrollRef = useRef<HTMLElement | null>(null)


  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false)
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [showCreateSprintModal, setShowCreateSprintModal] = useState(false)
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [showMultiStatsModal, setShowMultiStatsModal] = useState(false)
  const [boardStats, setBoardStats] = useState<BoardStatsViewModel | null>(null)
  const [aiBoardStats, setAiBoardStats] = useState<KanbanBoardStatsResponse | null>(null)
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false)

  const [createBoardValue, setCreateBoardValue] = useState('')
  const [createTaskValue, setCreateTaskValue] = useState(defaultTaskForm)
  const [createSprintValue, setCreateSprintValue] = useState({ name: '', goalId: '', projectId: '', status: 'planned', startDate: '', endDate: '' })
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<BoardTask | null>(null)
  const [createTaskColumnId, setCreateTaskColumnId] = useState('')
  const [membersSelectedUserId, setMembersSelectedUserId] = useState('')
  const [membersSelectedRole, setMembersSelectedRole] = useState('member')
  const [membersSelectedTeamRole, setMembersSelectedTeamRole] = useState('')

  const [isMutating, setIsMutating] = useState(false)
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false)
  const [advancedPanelSection, setAdvancedPanelSection] = useState<'all' | 'background' | 'labels'>('all')
  const [showEditBoardModal, setShowEditBoardModal] = useState(false)
  const [editBoardValue, setEditBoardValue] = useState('')
  const [showDeleteBoardConfirm, setShowDeleteBoardConfirm] = useState(false)
  const [showDeleteSprintConfirm, setShowDeleteSprintConfirm] = useState(false)
  
  const [uploadedFilesForNewTask, setUploadedFilesForNewTask] = useState<{ id: string; fileName: string }[]>([])


  // Alem AI States
  const [showAlemAiUploadModal, setShowAlemAiUploadModal] = useState(false)
  const [isAlemAiProcessing, setIsAlemAiProcessing] = useState(false)
  const [generatedAiTasks, setGeneratedAiTasks] = useState<TzAiTaskItem[]>([])
  const [aiTaskAssistResult, setAiTaskAssistResult] = useState<TzAiTaskAssistResponse | null>(null)
  const [aiKanbanContext, setAiKanbanContext] = useState<Record<string, { 
    board: { id: string; name: string }; 
    columns: { column: { id: string; name: string } }[]; 
    sprints: { id: string; name: string }[]; 
    members: { user_id: number; name: string }[]; 
  }>>({})
  const [showAiGeneratedTasks, setShowAiGeneratedTasks] = useState(false)
  const [activity, setActivity] = useState<BoardActivityViewModel | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [labels, setLabels] = useState<BoardLabelViewModel[]>([])
  const [comments, setComments] = useState<BoardCommentViewModel[]>([])
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false)
  const [isLabelsLoading, setIsLabelsLoading] = useState(false)
  const [isCommentsLoading, setIsCommentsLoading] = useState(false)
  const [resolvedBackgroundImageUrl, setResolvedBackgroundImageUrl] = useState('')

  const resetTaskCreate = useCallback(() => {
    setCreateTaskValue(defaultTaskForm)
    setUploadedFilesForNewTask([])
    setCreateTaskColumnId('')
  }, [])

  const syncBoardUrl = useCallback((boardId?: string, taskId?: string) => {
    const nextUrl = buildBoardUrl(boardId, taskId)
    const currentUrl = `${location.pathname}${location.search}`

    if (currentUrl !== nextUrl) {
      navigate(nextUrl, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  const [columnPrompt, setColumnPrompt] = useState<{
    mode: 'create' | 'rename'
    columnId: string
    initialValue: string
    initialKey: string
    open: boolean
  }>({
    mode: 'create',
    columnId: '',
    initialValue: '',
    initialKey: '',
    open: false,
  })
  const [columnPromptValue, setColumnPromptValue] = useState('')
  const [columnPromptKey, setColumnPromptKey] = useState('')
  const [deleteColumnId, setDeleteColumnId] = useState('')
  const [confirmDeleteTaskOpen, setConfirmDeleteTaskOpen] = useState(false)

  const [activePlanTab, setActivePlanTab] = useState<'board' | 'goals' | 'projects' | 'sprints'>('board')
  const [goalFormName, setGoalFormName] = useState('')
  const [goalFormDescription, setGoalFormDescription] = useState('')
  const [projectFormName, setProjectFormName] = useState('')
  const [projectFormDescription, setProjectFormDescription] = useState('')
  const [projectFormGoalId, setProjectFormGoalId] = useState('')
  const [goalEditState, setGoalEditState] = useState<{ open: boolean; goalId: string; name: string; description: string }>({
    open: false,
    goalId: '',
    name: '',
    description: '',
  })
  const [projectEditState, setProjectEditState] = useState<{ open: boolean; projectId: string; name: string; description: string; goalId: string; status: string }>({
    open: false,
    projectId: '',
    name: '',
    description: '',
    goalId: '',
    status: 'active',
  })
  const [sprintEditState, setSprintEditState] = useState<{ open: boolean; sprintId: string; name: string; goalId: string; projectId: string; status: string; startDate: string; endDate: string }>({
    open: false,
    sprintId: '',
    name: '',
    goalId: '',
    projectId: '',
    status: 'planned',
    startDate: '',
    endDate: '',
  })
  const [sprintLinkOverrides, setSprintLinkOverrides] = useState<Record<string, SprintLinkOverride>>({})
  const persistSprintLinkOverride = useCallback((boardId: string, sprintId: string, value: SprintLinkOverride) => {
    setSprintLinkOverrides((prev) => {
      const next = { ...prev }

      if (value.goalId || value.projectId) {
        next[sprintId] = value
      } else {
        delete next[sprintId]
      }

      writeSprintLinkOverrides(boardId, next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!selectedBoardId) {
      setSprintLinkOverrides({})
      return
    }

    setSprintLinkOverrides(readSprintLinkOverrides(selectedBoardId))
  }, [selectedBoardId])

  const selectedTask = useMemo(() => {
    if (!boardDetails || !selectedTaskId) return null
    const findTask = (tasks: typeof boardDetails.columns[number]['tasks']): typeof boardDetails.columns[number]['tasks'][number] | null => {
      for (const task of tasks) {
        if (task.id === selectedTaskId) return task
        const nested = findTask(task.subtasks ?? [])
        if (nested) return nested
      }
      return null
    }

    for (const column of boardDetails.columns) {
      const task = findTask(column.tasks)
      if (task) {
        return task
      }
    }
    return null
  }, [boardDetails, selectedTaskId])

  const selectedTaskEntity = useMemo<BoardTask | null>(() => {
    if (selectedTaskDetails && selectedTaskDetails.id === selectedTaskId) {
      return selectedTaskDetails
    }
    if (!selectedTask || !boardDetails) return null

    const fromBoard = boardDetails.columns.flatMap((column) => column.tasks).find((task) => task.id === selectedTask.id)
    const findTask = (tasks: typeof boardDetails.columns[number]['tasks']): typeof boardDetails.columns[number]['tasks'][number] | null => {
      for (const task of tasks) {
        if (task.id === selectedTask.id) return task
        const nested = findTask(task.subtasks ?? [])
        if (nested) return nested
      }
      return null
    }
    const fromTree = fromBoard ?? findTask(boardDetails.columns.flatMap((column) => column.tasks))
    if (!fromTree) return null

    return {
      id: fromTree.id,
      boardId: boardDetails.boardId,
      columnId: boardDetails.columns.find((column) => column.tasks.some((item) => item.id === fromTree.id))?.id ?? fromTree.boardId,
      sprintId: fromTree.sprintId,
      taskNumber: fromTree.taskNumber,
      taskKey: fromTree.taskKey,
      link: fromTree.link,
      title: fromTree.title,
      description: fromTree.description,
      priority: fromTree.priority,
      assigneeIds: fromTree.assigneeIds,
      originalEstimateSec: 0,
      timeSpentSec: 0,
      dueAt: fromTree.dueAt,
      status: fromTree.status,
      parentId: fromTree.parentId,
      subtasks: [],
      createdBy: fromTree.createdBy,
      createdAt: fromTree.createdAt,
      updatedAt: fromTree.updatedAt,
      attachments: [],
      labels: (fromTree.labels ?? []).map((label) => ({
        id: label.id,
        boardId: boardDetails.boardId,
        name: label.name,
        color: label.color,
        createdAt: '',
      })),
    }
  }, [boardDetails, selectedTask, selectedTaskDetails, selectedTaskId])

  const allBoardTasks = useMemo(() => {
    const result: Array<BoardDetailsViewModel['columns'][number]['tasks'][number]> = []
    const visit = (tasks: BoardDetailsViewModel['columns'][number]['tasks']) => {
      for (const task of tasks) {
        result.push(task)
        visit(task.subtasks ?? [])
      }
    }
    visit(boardDetails?.columns.flatMap((column) => column.tasks) ?? [])
    return result
  }, [boardDetails])

  const selectedParentTask = useMemo(() => {
    if (!selectedTaskEntity?.parentId) return null
    return allBoardTasks.find((task) => task.id === selectedTaskEntity.parentId) ?? null
  }, [allBoardTasks, selectedTaskEntity?.parentId])

  const parentTaskOptions = useMemo(() => {
    if (!selectedTaskEntity) return allBoardTasks

    const excluded = new Set<string>([selectedTaskEntity.id])
    const visit = (tasks: BoardTask['subtasks']) => {
      for (const task of tasks ?? []) {
        excluded.add(task.id)
        visit(task.subtasks)
      }
    }
    visit(selectedTaskEntity.subtasks)

    return allBoardTasks.filter((task) => !excluded.has(task.id))
  }, [allBoardTasks, selectedTaskEntity])

  const currentUserRole = useMemo(() => {
    if (!boardDetails || currentUserId === null) return 'member'
    if (boardDetails.ownerId === currentUserId) return 'owner'
    const member = boardDetails.members.find((m) => m.userId === currentUserId)
    return member?.role || 'member'
  }, [boardDetails, currentUserId])

  const knownUsersById = useMemo(() => {
    const map = new Map<number, string>()

    for (const user of users) {
      map.set(user.id, user.fullName)
    }

    for (const member of boardDetails?.members ?? []) {
      if (!map.has(member.userId)) {
        map.set(member.userId, member.name)
      }
    }

    return map
  }, [boardDetails?.members, users])

  const knownUserAvatarsById = useMemo(() => {
    const map = new Map<number, string>()

    for (const user of users) {
      if (user.avatarUrl) {
        map.set(user.id, user.avatarUrl)
      }
    }

    for (const member of boardDetails?.members ?? []) {
      if (member.avatarUrl && !map.has(member.userId)) {
        map.set(member.userId, member.avatarUrl)
      }
    }

    return map
  }, [boardDetails?.members, users])

  const boardMembersAsUsers = useMemo<BoardUserViewModel[]>(() => {
    return boardDetails?.members?.map((m) => {
      const u = users.find((user) => user.id === m.userId)
      return {
        id: m.userId,
        fullName: m.name,
        email: u?.email || '',
        avatarUrl: m.avatarUrl || u?.avatarUrl || '',
        initials: m.initials || u?.initials || '??',
        teamRole: m.teamRole || '',
      }
    }) ?? []
  }, [boardDetails, users])

  const modalUsers = useMemo<BoardUserViewModel[]>(() => {
    if (!boardDetails) return []

    return boardDetails.members.map((member) => {
      const u = users.find((user) => user.id === member.userId)
      return {
        id: member.userId,
        email: u?.email || '',
        firstName: '',
        lastName: '',
        fullName: member.name,
        username: '',
        avatarUrl: u?.avatarUrl || '',
        role: member.role,
        teamRole: member.teamRole || '',
        availabilityStatus: '',
        initials: member.initials || u?.initials || '??',
      }
    })
  }, [boardDetails, users])

  const isBoardOwner = useMemo(() => {
    if (!boardDetails || currentUserId === null) return false
    return boardDetails.ownerId === currentUserId
  }, [boardDetails, currentUserId])

  const mapHistoryDetailsToColumnNames = useCallback((input: BoardActivityViewModel): BoardActivityViewModel => {
    if (!boardDetails) return input

    const columnsById = new Map(boardDetails.columns.map((column) => [column.id, column.name]))

    return {
      ...input,
      history: input.history.map((item) => {
        let details = item.details

        for (const [columnId, columnName] of columnsById.entries()) {
          if (details.includes(columnId)) {
            details = details.split(columnId).join(columnName)
          }
        }

        const userIdFromLabel = /^User\s+(\d+)$/.exec(item.userName)?.[1]
        const parsedUserId = userIdFromLabel ? Number(userIdFromLabel) : null
        const resolvedUserName = parsedUserId !== null && knownUsersById.has(parsedUserId)
          ? knownUsersById.get(parsedUserId) ?? item.userName
          : item.userName

        return {
          ...item,
          details,
          userName: resolvedUserName,
        }
      }),
    }
  }, [boardDetails, knownUsersById])

  const loadBoard = useCallback(async (boardId: string, options?: { force?: boolean; silent?: boolean }) => {
    const force = options?.force ?? false
    const silent = options?.silent ?? false

    if (!silent) {
      setIsBoardLoading(true)
    }
    setError('')

    try {
      const details = await boardController.loadBoard(boardId, force)
      const hydratedDetails = applySprintLinkOverrides(details, readSprintLinkOverrides(boardId))
      setBoardDetails(hydratedDetails)
      window.localStorage.setItem(LAST_BOARD_KEY, boardId)

      // Initialize pagination
      const hasMore: Record<string, boolean> = {}
      const offsets: Record<string, number> = {}
      hydratedDetails.columns.forEach((col) => {
        hasMore[col.id] = col.totalTasks > col.tasks.length
        offsets[col.id] = col.tasks.length
      })
      setColumnHasMore(hasMore)
      setColumnOffsets(offsets)
    } catch (error) {
      setApiError(error, 'Не удалось загрузить доску. Попробуйте еще раз.')
    } finally {
      setIsBoardLoading(false)
    }
  }, [boardController, setApiError])

  useEffect(() => {
    if (!boardDetails) return

    const hydratedDetails = applySprintLinkOverrides(boardDetails, sprintLinkOverrides)
    if (hydratedDetails !== boardDetails) {
      setBoardDetails(hydratedDetails)
    }
  }, [boardDetails, sprintLinkOverrides])

  const lastLoadTimeRef = useRef<Record<string, number>>({})

  const handleLoadMoreTasks = useCallback(async (columnId: string) => {
    if (!selectedBoardId || columnLoadingMore[columnId] || !columnHasMore[columnId]) return

    // Throttle: don't load more than once every 500ms per column
    const now = Date.now()
    const lastLoad = lastLoadTimeRef.current[columnId] || 0
    if (now - lastLoad < 500) return
    lastLoadTimeRef.current[columnId] = now

    setColumnLoadingMore((prev) => ({ ...prev, [columnId]: true }))

    try {
      const currentOffset = columnOffsets[columnId] || 0
      const limit = 10

      const moreTasks = await boardController.searchTasks({
        boardId: selectedBoardId,
        columnIds: [columnId],
        limit,
        offset: currentOffset,
      })

      if (moreTasks.length > 0) {
        setBoardDetails((prev) => {
          if (!prev) return null
          return {
            ...prev,
            columns: prev.columns.map((col) => {
              if (col.id === columnId) {
                // Filter out tasks that might already exist (rare but possible with dynamic boards)
                const existingIds = new Set(col.tasks.map((t) => t.id))
                const uniqueNewTasks = moreTasks.filter((t) => !existingIds.has(t.id))
                return {
                  ...col,
                  tasks: [...col.tasks, ...uniqueNewTasks],
                }
              }
              return col
            }),
          }
        })
        setColumnOffsets((prev) => ({ ...prev, [columnId]: currentOffset + moreTasks.length }))
        if (moreTasks.length < limit) {
          setColumnHasMore((prev) => ({ ...prev, [columnId]: false }))
        }
      } else {
        setColumnHasMore((prev) => ({ ...prev, [columnId]: false }))
      }
    } catch (err) {
      console.error('Failed to load more tasks', err)
    } finally {
      setColumnLoadingMore((prev) => ({ ...prev, [columnId]: false }))
    }
  }, [selectedBoardId, columnLoadingMore, columnHasMore, columnOffsets, boardController])

  const loadBootstrap = useCallback(async (force = false) => {
    setError('')
    if (!force) setIsBootstrapLoading(true)

    try {
      const result = await boardController.bootstrap(force)
      setBoards(result.boards)
      setUsers(result.users)

      if (!result.boards.length) {
        setBoardDetails(null)
        setShowCreateBoardModal(true)
        return
      }

      const stored = window.localStorage.getItem(LAST_BOARD_KEY)
      const routeHit = requestedBoardId && result.boards.some((item) => item.id === requestedBoardId)
      const storedHit = stored && result.boards.some((item) => item.id === stored)

      let nextSelected = ''
      if (skipBoardPicker) {
        if (routeHit) {
          nextSelected = requestedBoardId
        } else if (storedHit) {
          nextSelected = stored
        } else {
          nextSelected = result.boards[0].id
        }
      }

      setSelectedBoardId((prev) => prev || nextSelected)
    } catch (error) {
      setApiError(error, 'Не удалось загрузить данные доски.')
    } finally {
      setIsBootstrapLoading(false)
    }
  }, [boardController, requestedBoardId, setApiError, skipBoardPicker])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  useEffect(() => {
    if (!boards.length) {
      setBoardProgressById({})
      setBoardMembersById({})
      return
    }

    let isCancelled = false

    const progress = Object.fromEntries(
      boards.map((board) => [board.id, Math.max(0, Math.min(100, Math.round(board.progress?.completionPercent ?? 0)))])
    ) as Record<string, number>

    setBoardProgressById(progress)

    void (async () => {
      try {
        const entries: Array<[string, Array<{ initials: string; name: string; avatarUrl?: string }>]> = await Promise.all(
          boards.map(async (board) => {
            try {
              const details = await boardController.loadBoard(board.id)
              const members = (details.members || [])
                .slice(0, 3)
                .map((member) => ({
                  initials: member.initials || member.name?.slice(0, 2).toUpperCase() || '??',
                  name: member.name,
                  avatarUrl: member.avatarUrl,
                }))
              return [board.id, members] as [string, Array<{ initials: string; name: string; avatarUrl?: string }>]
            } catch {
              return [board.id, [] as Array<{ initials: string; name: string; avatarUrl?: string }>] as [string, Array<{ initials: string; name: string; avatarUrl?: string }>]
            }
          }),
        )

        if (!isCancelled) {
          const members: Record<string, Array<{ initials: string; name: string; avatarUrl?: string }>> = {}
          for (const [boardId, boardMembers] of entries) {
            members[boardId] = boardMembers
          }
          setBoardMembersById(members)
        }
      } catch {
        if (!isCancelled) {
          setBoardMembersById({})
        }
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [boardController, boards])

  useEffect(() => {
    let isCancelled = false

    void authController
      .refreshIfExpiringSoon()
      .then((model) => {
        if (!isCancelled) {
          setCurrentUserId(model.userId)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCurrentUserId(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [authController])

  useEffect(() => {
    if (!selectedBoardId) return
    void loadBoard(selectedBoardId)
  }, [loadBoard, selectedBoardId])

  useEffect(() => {
    pendingRequestedTaskIdRef.current = requestedTaskId
  }, [requestedTaskId])

  useEffect(() => {
    if (!requestedBoardId || !boards.some((item) => item.id === requestedBoardId)) {
      return
    }

    setBoardView('kanban')
    setSelectedBoardId(requestedBoardId)
  }, [boards, requestedBoardId])

  useEffect(() => {
    if (!requestedTaskId || requestedBoardId || selectedBoardId) {
      return
    }

    let isCancelled = false

    void boardController
      .loadTask(requestedTaskId)
      .then((task) => {
        if (isCancelled) return
        pendingRequestedTaskIdRef.current = task.taskKey || task.id
        setBoardView('kanban')
        setSelectedBoardId(task.boardId)
      })
      .catch((error) => {
        if (!isCancelled) {
          setApiError(error, 'Не удалось открыть задачу по ссылке.')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [boardController, requestedBoardId, requestedTaskId, selectedBoardId, setApiError])

  useEffect(() => {
    if (!selectedBoardId) return

    void (async () => {
      setIsLabelsLoading(true)
      try {
        const nextLabels = await boardController.loadBoardLabels(selectedBoardId)
        setLabels(nextLabels)
      } catch {
        setLabels([])
      } finally {
        setIsLabelsLoading(false)
      }
    })()
  }, [boardController, selectedBoardId])

  useEffect(() => {
    const background = boardDetails?.background
    const shouldLoadImage = Boolean(isBoardOwner && background?.imageUrl && selectedBoardId && (background.mode || '').toLowerCase().includes('image'))

    if (!shouldLoadImage) {
      setResolvedBackgroundImageUrl('')
      return
    }

    let isCancelled = false
    let nextObjectUrl = ''

    void (async () => {
      try {
        const blob = await boardController.downloadBoardBackgroundImage(selectedBoardId)
        if (isCancelled) return

        nextObjectUrl = URL.createObjectURL(blob)
        setResolvedBackgroundImageUrl(nextObjectUrl)
      } catch {
        if (!isCancelled) {
          setResolvedBackgroundImageUrl('')
        }
      }
    })()

    return () => {
      isCancelled = true
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl)
      }
    }
  }, [boardController, boardDetails?.background, isBoardOwner, selectedBoardId])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (boardView !== 'kanban' || !selectedBoardId) {
      return
    }
    pushBoardVisitId(selectedBoardId)
  }, [boardView, selectedBoardId])

  useEffect(() => {
    if (boardView !== 'kanban' || !selectedBoardId || pendingRequestedTaskIdRef.current) {
      return
    }

    syncBoardUrl(selectedBoardId, showTaskDetailModal ? (selectedTaskEntity?.taskKey || selectedTaskId) : undefined)
  }, [boardView, selectedBoardId, selectedTaskEntity?.taskKey, selectedTaskId, showTaskDetailModal, syncBoardUrl])

  const isFilterActive = !!(selectedSprintId || search || filterLabelId || filterUserId || filterStatus || filterDate)

  const filteredColumns = useMemo(() => {
    if (!boardDetails) return []

    const normalizedSearch = search.trim().toLowerCase()
    const normalizedFilterDate = filterDate.trim()

    return boardDetails.columns.map((column) => {
      const filteredTasks = column.tasks.filter((task) => {
        const bySprint = !selectedSprintId || task.sprintId === selectedSprintId
        if (!bySprint) return false

        const byLabel = !filterLabelId || task.labels?.some((label) => label.id === filterLabelId)
        if (!byLabel) return false

        const byAssignee = !filterUserId || task.assigneeIds.includes(Number(filterUserId))
        if (!byAssignee) return false

        const byStatus = !filterStatus || (task.status ?? '').toUpperCase() === filterStatus.toUpperCase()
        if (!byStatus) return false

        const byDate =
          !normalizedFilterDate ||
          (task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) === normalizedFilterDate : false)
        if (!byDate) return false

        if (!normalizedSearch) return true
        return (
          task.taskKey.toLowerCase().includes(normalizedSearch) ||
          task.title.toLowerCase().includes(normalizedSearch) ||
          task.description.toLowerCase().includes(normalizedSearch)
        )
      })

      return {
        ...column,
        tasks: filteredTasks,
        totalTasks: isFilterActive ? filteredTasks.length : column.totalTasks,
      }
    })
  }, [boardDetails, search, selectedSprintId, filterLabelId, filterUserId, filterStatus, filterDate])

  const totalTasksCount = useMemo(() => {
    if (!boardDetails) return 0
    if (isFilterActive) {
      return filteredColumns.reduce((sum, col) => sum + col.tasks.length, 0)
    }
    return boardDetails.totalTasks
  }, [boardDetails, filteredColumns, isFilterActive])

  const handleResetFilters = useCallback(() => {
    setSelectedSprintId('')
    setFilterUserId('')
    setFilterStatus('')
    setFilterDate('')
    setSearch('')
    setFilterLabelId('')
  }, [])

  const quickActionTasks = useMemo(() => {
    if (!boardDetails) return [] as Array<{ id: string; title: string; columnName: string }>

    return boardDetails.columns.flatMap((column) =>
      column.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        columnName: column.name,
      })),
    )
  }, [boardDetails])

  const handleAlemAiUpload = async (file: File) => {
    setIsAlemAiProcessing(true)
    setError('')
    try {
      const response = await alemAiRepository.analyzeTzViaLocalApi(file)
      setGeneratedAiTasks(response.tasks)
      setAiKanbanContext(response.kanban_context)
      setShowAlemAiUploadModal(false)
      setShowAiGeneratedTasks(true)
    } catch (err) {
      setApiError(err, 'Не удалось проанализировать ТЗ')
    } finally {
      setIsAlemAiProcessing(false)
    }
  }

  const handleTaskAiAssist = async () => {
    const hasTitle = createTaskValue.title.trim()
    const hasDesc = createTaskValue.description.trim()
    if (!hasTitle && !hasDesc) return

    setIsAlemAiProcessing(true)
    setError('')
    try {
      const res = await alemAiRepository.getTaskAssist({
        title: hasTitle || hasDesc.slice(0, 60),
        text: hasDesc || hasTitle,
        board_id: selectedBoardId || undefined,
        current_priority: createTaskValue.priority as any,
        current_sprint_id: createTaskValue.sprintId || undefined,
        current_assignee_id: createTaskValue.assigneeIds[0] || undefined,
        current_due_at: createTaskValue.dueAt || undefined,
        file_ids: createTaskValue.attachmentFileIds,
      })
      setAiTaskAssistResult(res)
    } catch (err) {
      setApiError(err, 'Не удалось получить помощь ИИ для задачи')
    } finally {
      setIsAlemAiProcessing(false)
    }
  }

  const handleEditTaskAiAssist = async () => {
    if (!selectedTaskEntity) return
    const hasTitle = selectedTaskEntity.title?.trim()
    const hasDesc = selectedTaskEntity.description?.trim()
    if (!hasTitle && !hasDesc) return

    setIsAlemAiProcessing(true)
    setError('')
    try {
      const res = await alemAiRepository.getTaskAssist({
        title: hasTitle || hasDesc?.slice(0, 60) || 'Задача',
        text: hasDesc || hasTitle || '',
        board_id: selectedTaskEntity.boardId,
        current_priority: selectedTaskEntity.priority,
        current_sprint_id: selectedTaskEntity.sprintId,
        current_assignee_id: selectedTaskEntity.assigneeIds[0],
        current_due_at: selectedTaskEntity.dueAt,
        file_ids: selectedTaskEntity.attachments.map(a => a.id),
      })
      setAiTaskAssistResult(res)
    } catch (err) {
      setApiError(err, 'Не удалось получить помощь ИИ для задачи')
    } finally {
      setIsAlemAiProcessing(false)
    }
  }

  const handleApplyAiTaskAssist = () => {
    if (!aiTaskAssistResult) return
    const res = aiTaskAssistResult
    const sug = res.ai_suggestion
    
    if (showCreateTaskModal) {
      setCreateTaskValue(prev => ({
        ...prev,
        title: res.suggested_title || prev.title,
        description: res.description || prev.description,
        priority: (sug?.priority as any) || prev.priority,
        sprintId: sug?.sprint_id || prev.sprintId,
        assigneeIds: sug?.assignee_id ? [sug.assignee_id] : prev.assigneeIds,
        dueAt: sug?.due_at || prev.dueAt,
      }))
    } else if (selectedTaskEntity) {
      setSelectedTaskDetails(prev => {
        if (!prev) return prev
        return {
          ...prev,
          title: res.suggested_title || prev.title,
          description: res.description || prev.description,
          priority: (sug?.priority as any) || prev.priority,
          sprintId: sug?.sprint_id || prev.sprintId,
          assigneeIds: sug?.assignee_id ? [sug.assignee_id] : prev.assigneeIds,
          dueAt: sug?.due_at || prev.dueAt,
        }
      })
    }
    
    setAiTaskAssistResult(null)
    setToast('Настройки ИИ применены')
  }

  const handleAlemAiConfirm = async (tasks: TzAiTaskItem[]) => {
    setIsMutating(true)
    try {
      await alemAiRepository.createTzTasks(tasks)
      setShowAiGeneratedTasks(false)
      setToast(`Успешно создано задач: ${tasks.length}`)
      
      const firstBoardId = tasks[0]?.board_id
      if (firstBoardId && firstBoardId !== selectedBoardId) {
        setSelectedBoardId(firstBoardId)
      } else {
        void handleRefresh()
      }
    } catch (err) {
      setApiError(err, 'Не удалось создать задачи')
    } finally {
      setIsMutating(false)
    }
  }

  const handleRefresh = async () => {
    if (!selectedBoardId) return
    setIsRefreshing(true)
    boardController.invalidateAll()
    await loadBootstrap(true)
    await loadBoard(selectedBoardId, { force: true, silent: true })
    setIsRefreshing(false)
  }

  const setColumnCardRef = useCallback((columnId: string, node: HTMLDivElement | null) => {
    if (!node) {
      columnRefs.current.delete(columnId)
      return
    }
    columnRefs.current.set(columnId, node)
  }, [])

  const animateColumnReorder = useCallback(
    (previousRects: Map<string, DOMRect>, orderedColumnIds: string[]) => {
      window.requestAnimationFrame(() => {
        for (const columnId of orderedColumnIds) {
          const element = columnRefs.current.get(columnId)
          const previousRect = previousRects.get(columnId)
          if (!element || !previousRect) continue

          const nextRect = element.getBoundingClientRect()
          const deltaX = previousRect.left - nextRect.left
          if (!deltaX) continue

          element.style.transition = 'none'
          element.style.transform = `translateX(${deltaX}px)`

          window.requestAnimationFrame(() => {
            element.style.transition = 'transform 240ms cubic-bezier(0.2, 0, 0, 1)'
            element.style.transform = 'translateX(0)'

            const cleanup = () => {
              element.style.transition = ''
              element.style.transform = ''
              element.removeEventListener('transitionend', cleanup)
            }

            element.addEventListener('transitionend', cleanup)
          })
        }
      })
    },
    [],
  )

  const handleColumnDrop = async (targetColumnId: string) => {
    if (dragTaskState || !dragColumnId || !boardDetails || !selectedBoardId || dragColumnId === targetColumnId) return

    const fromIndex = boardDetails.columns.findIndex((item) => item.id === dragColumnId)
    const toIndex = boardDetails.columns.findIndex((item) => item.id === targetColumnId)
    if (fromIndex < 0 || toIndex < 0) return

    const previous = boardDetails
    const previousRects = new Map<string, DOMRect>()
    for (const column of boardDetails.columns) {
      const element = columnRefs.current.get(column.id)
      if (element) {
        previousRects.set(column.id, element.getBoundingClientRect())
      }
    }
    const reordered = moveArrayItem(boardDetails.columns, fromIndex, toIndex)
      .map((column, index) => ({ ...column, position: index }))

    setBoardDetails({ ...boardDetails, columns: reordered })
    setDragColumnId('')
    setColumnDropTargetId('')
    animateColumnReorder(previousRects, reordered.map((column) => column.id))

    try {
      await boardController.moveColumn(selectedBoardId, dragColumnId, toIndex)
    } catch (error) {
      setBoardDetails(previous)
      setApiError(error, 'Не удалось сохранить порядок колонок. Выполнен откат.')
      await loadBoard(selectedBoardId, { force: true, silent: true })
    }
  }

  const handleTaskDrop = async (targetColumnId: string) => {
    if (dragColumnId || !dragTaskState || !boardDetails || !selectedBoardId) return
    
    // We now allow dropping in the same column (it will move to top)


    const previous = boardDetails
    const sourceColumn = boardDetails.columns.find((item) => item.id === dragTaskState.sourceColumnId)
    const targetColumn = boardDetails.columns.find((item) => item.id === targetColumnId)
    if (!sourceColumn || !targetColumn) return

    const task = sourceColumn.tasks.find((item) => item.id === dragTaskState.taskId)
    if (!task) return

    const nextColumns = boardDetails.columns.map((column) => {
      const isRoot = !task.parentId
      if (column.id === sourceColumn.id && column.id === targetColumn.id) {
        // Move within same column: remove and put at top
        const filtered = column.tasks.filter((item) => item.id !== dragTaskState.taskId)
        return { ...column, tasks: [{ ...task }, ...filtered] }
      }
      if (column.id === sourceColumn.id) {
        return {
          ...column,
          tasks: column.tasks.filter((item) => item.id !== dragTaskState.taskId),
          totalTasks: isRoot ? Math.max(0, column.totalTasks - 1) : column.totalTasks,
        }
      }
      if (column.id === targetColumn.id) {
        return {
          ...column,
          tasks: [{ ...task }, ...column.tasks],
          totalTasks: isRoot ? column.totalTasks + 1 : column.totalTasks,
        }
      }
      return column
    })
    setBoardDetails({ ...boardDetails, columns: nextColumns })
    setDragTaskState(null)

    try {
      await boardController.moveTask(task.boardId, task.id, targetColumnId)
      
      // If column is linked to a status, update task status as well
      const normalizedTargetKey = normalizeStatusKey(targetColumn.key)
      const currentTaskKey = statusLabelToKey(task.status)
      
      if (normalizedTargetKey && normalizedTargetKey !== currentTaskKey && ['TODO', 'IN_PROGRESS', 'TEST', 'DONE'].includes(normalizedTargetKey)) {
        await boardController.updateTaskStatus(task.boardId, task.id, normalizedTargetKey)
      }
    } catch (error) {
      setBoardDetails(previous)
      setApiError(error, 'Не удалось переместить задачу. Выполнен откат.')
      await loadBoard(selectedBoardId, { force: true, silent: true })
    }
  }

  const refreshSelectedTaskDetails = useCallback(async (taskId: string) => {
    const loadedTask = await boardController.loadTask(taskId)
    setSelectedTaskDetails(loadedTask)
    return loadedTask
  }, [boardController])

  const openTaskDetail = useCallback(async (taskId: string) => {
    setSelectedTaskId(taskId)
    setSelectedTaskDetails(null)
    setShowTaskDetailModal(true)
    setActivityLoading(true)
    setIsCommentsLoading(true)
    try {
      const [loadedActivity, loadedComments, loadedTask] = await Promise.all([
        boardController.loadTaskActivity(taskId),
        boardController.loadTaskComments(taskId),
        refreshSelectedTaskDetails(taskId),
      ])
      setActivity(mapHistoryDetailsToColumnNames(loadedActivity))
      setComments(loadedComments)
      setSelectedTaskDetails(loadedTask)
    } catch {
      setActivity(null)
      setComments([])
      setSelectedTaskDetails(null)
    } finally {
      setActivityLoading(false)
      setIsCommentsLoading(false)
    }
  }, [boardController, mapHistoryDetailsToColumnNames, refreshSelectedTaskDetails])

  useEffect(() => {
    const pendingTaskId = pendingRequestedTaskIdRef.current

    if (!boardDetails || !pendingTaskId) {
      return
    }

    const findPendingTask = (tasks: BoardDetailsViewModel['columns'][number]['tasks']): BoardDetailsViewModel['columns'][number]['tasks'][number] | null => {
      for (const task of tasks) {
        if (task.id === pendingTaskId || task.taskKey.toLowerCase() === pendingTaskId.toLowerCase()) {
          return task
        }
        const nested = findPendingTask(task.subtasks ?? [])
        if (nested) {
          return nested
        }
      }
      return null
    }

    const pendingTask = findPendingTask(boardDetails.columns.flatMap((column) => column.tasks))

    if (!pendingTask) {
      return
    }

    pendingRequestedTaskIdRef.current = ''
    void openTaskDetail(pendingTask.id)
  }, [boardDetails, openTaskDetail])

  const handleSubmitColumnPrompt = async () => {
    if (!selectedBoardId) return

    const value = columnPromptValue.trim()
    if (!value) return

    if (columnPrompt.mode === 'rename') {
      if (!columnPrompt.columnId || value === columnPrompt.initialValue.trim()) {
        setColumnPrompt({ mode: 'create', columnId: '', initialValue: '', initialKey: '', open: false })
        setColumnPromptValue('')
        return
      }

      try {
        await boardController.updateColumn(selectedBoardId, columnPrompt.columnId, value, columnPromptKey)
        
        // If status link changed, update all tasks in this column
        const normalizedKey = normalizeStatusKey(columnPromptKey)
        const initialNormalizedKey = normalizeStatusKey(columnPrompt.initialKey)

        if (normalizedKey && normalizedKey !== initialNormalizedKey && ['TODO', 'IN_PROGRESS', 'TEST', 'DONE'].includes(normalizedKey)) {
          const column = boardDetails?.columns.find((c) => c.id === columnPrompt.columnId)
          if (column && column.tasks.length > 0) {
            await Promise.all(
              column.tasks.map((t) => boardController.updateTaskStatus(selectedBoardId, t.id, normalizedKey))
            )
          }
        }

        await loadBoard(selectedBoardId, { force: true, silent: true })
        setToast('Колонка обновлена')
      } catch (error) {
        setApiError(error, 'Не удалось обновить колонку')
      } finally {
        setColumnPrompt({ mode: 'create', columnId: '', initialValue: '', initialKey: '', open: false })
        setColumnPromptValue('')
        setColumnPromptKey('')
      }
      return
    }

    try {
      await boardController.createColumn(selectedBoardId, value, columnPromptKey)
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Колонка создана')
    } catch (error) {
      setApiError(error, 'Не удалось создать колонку')
    } finally {
      setColumnPrompt({ mode: 'create', columnId: '', initialValue: '', initialKey: '', open: false })
      setColumnPromptValue('')
      setColumnPromptKey('')
    }
  }

  const handleConfirmDeleteColumn = async () => {
    if (!selectedBoardId || !deleteColumnId) return

    try {
      await boardController.deleteColumn(selectedBoardId, deleteColumnId)
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Колонка удалена')
    } catch (error) {
      setApiError(error, 'Не удалось удалить колонку')
    } finally {
      setDeleteColumnId('')
    }
  }

  const handleConfirmDeleteTask = async () => {
    if (!selectedBoardId || !selectedTaskId) return

    try {
      await boardController.deleteTask(selectedBoardId, selectedTaskId)
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setShowTaskDetailModal(false)
      setSelectedTaskId('')
      setSelectedTaskDetails(null)
      setActivity(null)
      syncBoardUrl(selectedBoardId)
      setToast('Задача удалена')
    } catch (error) {
      setApiError(error, 'Не удалось удалить задачу')
    } finally {
      setConfirmDeleteTaskOpen(false)
      setIsMutating(false)
    }
  }

  const handleDeleteSprint = async () => {
    if (!selectedBoardId || !selectedSprintId) return

    try {
      await boardController.deleteSprint(selectedBoardId, selectedSprintId)
      setSelectedSprintId('')
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setShowDeleteSprintConfirm(false)
      setToast('Спринт удален')
    } catch (error) {
      setApiError(error, 'Не удалось удалить спринт')
    } finally {
      setIsMutating(false)
    }
  }
  const boardSurfaceStyle = useMemo<CSSProperties | undefined>(() => {
    if (boardView === 'kanban' && !boardDetails?.background) {
      return { backgroundColor: KANBAN_PAGE_BG }
    }

    if (!boardDetails?.background || !isBoardOwner) {
      return boardView === 'kanban' ? { backgroundColor: KANBAN_PAGE_BG } : undefined
    }

    const mode = (boardDetails.background.mode || '').toLowerCase()
    const isPresetMode = mode.includes('preset') || mode.includes('color')
    const isImageMode = mode.includes('image')

    const hex = boardDetails.background.presetHex || PRESET_HEX_MAP[boardDetails.background.presetId] || ''

    if (isPresetMode && hex) {
      return {
        backgroundColor: hex,
        backgroundImage: `linear-gradient(180deg, ${hex} 0%, #F3F6FB 48%)`,
      }
    }

    if ((isImageMode || (!isPresetMode && !isImageMode)) && resolvedBackgroundImageUrl) {
      return {
        backgroundImage: `url(${resolvedBackgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }

    if (hex) {
      return {
        backgroundColor: hex,
        backgroundImage: `linear-gradient(180deg, ${hex} 0%, #F3F6FB 48%)`,
      }
    }

    return undefined
  }, [boardView, boardDetails, isBoardOwner, resolvedBackgroundImageUrl])


  const handleUpdateBoard = async () => {
    if (!selectedBoardId || !editBoardValue.trim()) return
    setIsMutating(true)
    try {
      await boardController.updateBoard(selectedBoardId, editBoardValue.trim())
      setToast('Доска обновлена')
      setShowEditBoardModal(false)
      await handleRefresh()
    } catch (error) {
      setApiError(error, 'Не удалось обновить доску')
    } finally {
      setIsMutating(false)
    }
  }

  const openBoardPicker = useCallback(() => {
    setBoardView('picker')
    setSelectedBoardId('')
    setBoardDetails(null)
    setActivePlanTab('board')
    syncBoardUrl()
  }, [syncBoardUrl])

  const handleCreateGoalSubmit = async () => {
    if (!selectedBoardId || !goalFormName.trim()) return
    setIsMutating(true)
    try {
      await boardController.createGoal(selectedBoardId, {
        name: goalFormName.trim(),
        description: goalFormDescription.trim() || undefined,
      })
      setGoalFormName('')
      setGoalFormDescription('')
      setShowCreateGoalModal(false)
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Цель создана')
    } catch (error) {
      setApiError(error, 'Не удалось создать цель')
    } finally {
      setIsMutating(false)
    }
  }

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBoardId || !projectFormName.trim()) return
    setIsMutating(true)
    try {
      await boardController.createProject(selectedBoardId, {
        name: projectFormName.trim(),
        description: projectFormDescription.trim() || undefined,
        goalId: projectFormGoalId || undefined,
      })
      setProjectFormName('')
      setProjectFormDescription('')
      setProjectFormGoalId('')
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Проект создан')
    } catch (error) {
      setApiError(error, 'Не удалось создать проект')
    } finally {
      setIsMutating(false)
    }
  }

  const handleUpdateGoalSubmit = async () => {
    if (!selectedBoardId || !goalEditState.goalId || !goalEditState.name.trim()) return
    setIsMutating(true)
    try {
      await boardController.updateGoal(selectedBoardId, goalEditState.goalId, {
        name: goalEditState.name.trim(),
        description: goalEditState.description.trim() || undefined,
      })
      setGoalEditState({ open: false, goalId: '', name: '', description: '' })
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Цель обновлена')
    } catch (error) {
      setApiError(error, 'Не удалось обновить цель')
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteGoalById = async (goalId: string) => {
    if (!selectedBoardId || !goalId) return
    if (!window.confirm('Удалить эту цель? Привязки задач, проектов и спринтов к ней будут очищены.')) return
    setIsMutating(true)
    try {
      await boardController.deleteGoal(selectedBoardId, goalId)
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Цель удалена')
    } catch (error) {
      setApiError(error, 'Не удалось удалить цель')
    } finally {
      setIsMutating(false)
    }
  }

  const handleUpdateProjectSubmit = async () => {
    if (!selectedBoardId || !projectEditState.projectId || !projectEditState.name.trim()) return
    setIsMutating(true)
    try {
      await boardController.updateProject(selectedBoardId, projectEditState.projectId, {
        name: projectEditState.name.trim(),
        description: projectEditState.description.trim() || undefined,
        goalId: projectEditState.goalId || undefined,
        status: projectEditState.status,
      })
      setProjectEditState({ open: false, projectId: '', name: '', description: '', goalId: '', status: 'active' })
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Проект обновлен')
    } catch (error) {
      setApiError(error, 'Не удалось обновить проект')
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteProjectById = async (projectId: string) => {
    if (!selectedBoardId || !projectId) return
    if (!window.confirm('Удалить этот проект? Привязки задач и спринтов к нему будут очищены.')) return
    setIsMutating(true)
    try {
      await boardController.deleteProject(selectedBoardId, projectId)
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Проект удален')
    } catch (error) {
      setApiError(error, 'Не удалось удалить проект')
    } finally {
      setIsMutating(false)
    }
  }

  const handleUpdateSprintById = async () => {
    if (!selectedBoardId || !sprintEditState.sprintId || !sprintEditState.name.trim()) return
    setIsMutating(true)
    try {
      const updatedSprint = await boardController.updateSprint(selectedBoardId, sprintEditState.sprintId, {
        name: sprintEditState.name.trim(),
        goalId: sprintEditState.goalId || undefined,
        projectId: sprintEditState.projectId || undefined,
        status: sprintEditState.status,
        startDate: sprintEditState.startDate ? new Date(sprintEditState.startDate).toISOString() : undefined,
        endDate: sprintEditState.endDate ? new Date(sprintEditState.endDate).toISOString() : undefined,
      })
      persistSprintLinkOverride(selectedBoardId, updatedSprint.id, {
        goalId: updatedSprint.goalId || sprintEditState.goalId || undefined,
        projectId: updatedSprint.projectId || sprintEditState.projectId || undefined,
      })
      setSprintEditState({ open: false, sprintId: '', name: '', goalId: '', projectId: '', status: 'planned', startDate: '', endDate: '' })
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Спринт обновлен')
    } catch (error) {
      setApiError(error, 'Не удалось обновить спринт')
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteSprintById = async (sprintId: string) => {
    if (!selectedBoardId || !sprintId) return
    if (!window.confirm('Вы уверены, что хотите удалить этот спринт?')) return
    setIsMutating(true)
    try {
      await boardController.deleteSprint(selectedBoardId, sprintId)
      if (selectedSprintId === sprintId) {
        setSelectedSprintId('')
      }
      await loadBoard(selectedBoardId, { force: true, silent: true })
      setToast('Спринт удален')
    } catch (error) {
      setApiError(error, 'Не удалось удалить спринт')
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteBoard = async () => {
    if (!selectedBoardId) return
    setIsMutating(true)
    try {
      await boardController.deleteBoard(selectedBoardId)
      setToast('Доска удалена')
      setShowDeleteBoardConfirm(false)
      setSelectedBoardId('')
      setBoardDetails(null)
      setBoardView('picker')
      syncBoardUrl()
      await loadBootstrap(true)
    } catch (error) {
      setApiError(error, 'Не удалось удалить доску')
    } finally {
      setIsMutating(false)
    }
  }

  const loadAiBoardStats = useCallback(async (boardId: string) => {
    try {
      const stats = await alemAiRepository.getBoardStats(boardId)
      setAiBoardStats(stats)
    } catch (error) {
      console.error('Failed to load AI stats', error)
    }
  }, [alemAiRepository])

  const handleOpenStats = useCallback(async () => {
    if (!selectedBoardId) return
    setIsMutating(true)
    try {
      const stats = await boardController.loadBoardStats(selectedBoardId)
      setBoardStats(stats)
      setShowStatsModal(true)
      void loadAiBoardStats(selectedBoardId)
    } catch (error) {
      setApiError(error, 'Не удалось загрузить статистику доски.')
    } finally {
      setIsMutating(false)
    }
  }, [boardController, selectedBoardId, setApiError, loadAiBoardStats])

  useEffect(() => {
    if (!dragTaskState && !dragColumnId) return

    const handleWindowDragOver = (e: DragEvent) => {
      const threshold = 150
      const maxSpeed = 35

      if (mainContainerRef.current) {
        const rect = mainContainerRef.current.getBoundingClientRect()
        // Top edge
        if (e.clientY < rect.top + threshold) {
          const dist = Math.max(0, rect.top + threshold - e.clientY)
          const speed = (dist / threshold) * maxSpeed + 5
          mainContainerRef.current.scrollTop -= speed
        } 
        // Bottom edge
        else if (e.clientY > rect.bottom - threshold) {
          const dist = Math.max(0, e.clientY - (rect.bottom - threshold))
          const speed = (dist / threshold) * maxSpeed + 5
          mainContainerRef.current.scrollTop += speed
        }
      }

      if (columnsScrollRef.current) {
        const rect = columnsScrollRef.current.getBoundingClientRect()
        // Left edge
        if (e.clientX < rect.left + threshold) {
          const dist = Math.max(0, rect.left + threshold - e.clientX)
          const speed = (dist / threshold) * maxSpeed + 5
          columnsScrollRef.current.scrollLeft -= speed
        } 
        // Right edge
        else if (e.clientX > rect.right - threshold) {
          const dist = Math.max(0, e.clientX - (rect.right - threshold))
          const speed = (dist / threshold) * maxSpeed + 5
          columnsScrollRef.current.scrollLeft += speed
        }
      }
    }

    window.addEventListener('dragover', handleWindowDragOver)
    return () => window.removeEventListener('dragover', handleWindowDragOver)
  }, [dragTaskState, dragColumnId])

  const runAdvanced = useCallback(async (

    action: () => Promise<void>,
    onError: string,
    setLoading?: (value: boolean) => void,
  ) => {
    if (setLoading) setLoading(true)
    try {
      await action()
    } catch (err) {
      setApiError(err, onError)
    } finally {
      if (setLoading) setLoading(false)
    }
  }, [setApiError])

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return

    await runAdvanced(async () => {
      await boardController.deleteTaskFile(selectedTaskEntity.boardId, selectedTaskId, attachmentId)

      const [loadedActivity] = await Promise.all([
        boardController.loadTaskActivity(selectedTaskId),
        loadBoard(selectedBoardId, { force: true, silent: true }),
        refreshSelectedTaskDetails(selectedTaskId),
      ])

      setActivity(mapHistoryDetailsToColumnNames(loadedActivity))
      setToast('Файл удален')
    }, 'Не удалось удалить файл.', setIsMutating)
  }

  useEffect(() => {
    if (!showAdvancedPanel) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdvancedPanel(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showAdvancedPanel])

  const pickBoardLoading = isBootstrapLoading
  const kanbanBoardLoading = boardView === 'kanban' && Boolean(selectedBoardId) && isBoardLoading && !boardDetails
  const contentIsLoading = pickBoardLoading || kanbanBoardLoading

  return (
    <main
      ref={mainContainerRef}
      className={`custom-scrollbar min-h-0 flex-1 flex flex-col ${boardView === 'kanban' ? 'overflow-hidden' : 'overflow-y-auto'} ${boardView === 'kanban' ? '' : 'bg-transparent backdrop-blur-[2px]'}`}
      style={boardSurfaceStyle}
    >

      <div className={`flex min-h-0 flex-1 w-full flex-col ${boardView === 'kanban' ? 'px-4 py-5 md:px-8 md:py-6' : 'px-4 py-6 md:px-6 lg:px-8 lg:py-8'}`}>
      {/* Sticky Toolbar */}
      {(boardView === 'kanban' || boards.length === 0) && (
        <div
          className={
            boardView === 'kanban'
              ? 'relative z-[460] isolate mb-1 flex shrink-0 flex-wrap items-center gap-3'
              : 'relative z-[460] isolate flex shrink-0 items-center gap-2 rounded-2xl border border-[#DDE3EE] bg-white/95 px-4 py-2.5 shadow-[0_2px_8px_rgba(10,22,40,0.10)] backdrop-blur-md md:px-5'
          }
        >
          {boards.length > 0 ? (
            <>
              {boardView === 'kanban' ? (
                <button
                  type="button"
                  onClick={openBoardPicker}
                  aria-label="К списку AlemBoard"
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] font-normal text-[#4B5563] transition hover:bg-[#FAFAFA] md:px-3.5"
                >
                  <MaterialSymbol name="arrow_back" size={18} color="currentColor" />
                  <span className="hidden sm:inline">AlemBoard</span>
                </button>
              ) : null}
              <BoardFilters
                appearance={boardView === 'kanban' ? 'modern' : 'classic'}
                boards={boards}
                users={boardMembersAsUsers}
                selectedBoardId={selectedBoardId}
                sprintOptions={boardDetails?.sprints ?? []}
                selectedSprintId={selectedSprintId}
                search={search}
                filterUserId={filterUserId}
                filterStatus={filterStatus}
                filterDate={filterDate}
                onBoardChange={setSelectedBoardId}
                onSprintChange={setSelectedSprintId}
                onSearchChange={setSearch}
                onFilterUserChange={setFilterUserId}
                onFilterStatusChange={setFilterStatus}
                onFilterDateChange={setFilterDate}
                filterLabelId={filterLabelId}
                labels={labels}
                onFilterLabelChange={setFilterLabelId}
                onApplyFilters={() => {
                  setToast('Фильтры применены')
                }}
                onResetFilters={handleResetFilters}
                boardName={boardDetails?.boardName ?? 'Доска'}
                totalTasks={totalTasksCount}
                isRefreshing={isRefreshing}
                onRefresh={() => { void handleRefresh() }}
              />
              {boardView === 'kanban' && currentUserRole !== 'member' ? (
                <button
                  type="button"
                  onClick={() => {
                    const firstColumn = filteredColumns[0] ?? boardDetails?.columns[0]
                    if (!firstColumn) return
                    setCreateTaskColumnId(firstColumn.id)
                    setShowCreateTaskModal(true)
                  }}
                  className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-[13px] font-medium text-white transition hover:bg-[#1878CA]"
                >
                  <MaterialSymbol name="add" size={18} color="#fff" />
                  <span className="hidden sm:inline">Новая задача</span>
                </button>
              ) : null}
            </>
          ) : (
            <BoardHeader
              boardName={boardDetails?.boardName ?? 'Доска'}
              totalTasks={totalTasksCount}
              boardsCount={boards.length}
              isRefreshing={isRefreshing}
              onRefresh={() => { void handleRefresh() }}
            />
          )}

          {/* Board Tools Menu Trigger */}
          {boardDetails ? (
            <div className={`relative group ${showToolsMenu ? 'z-[460]' : 'z-20'}`}>
              <button
                type="button"
                onClick={() => setShowToolsMenu((prev) => !prev)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
                  showToolsMenu
                    ? 'text-[#00897B] ring-2 ring-[#B2DFDB]'
                    : 'text-[#455A64] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]'
                } ${boardView !== 'kanban' ? '!h-8 !w-8 !rounded-lg !border-[#DDE3EE] !shadow-none' : ''} ${
                  boardView !== 'kanban' && showToolsMenu ? '!border-[#1E88E5] !bg-[#EBF4FE] !text-[#1E88E5] !ring-0' : ''
                } ${boardView !== 'kanban' && !showToolsMenu ? 'hover:!border-[#1E88E5] hover:!text-[#1E88E5]' : ''}`}
              >
                <MaterialSymbol name="more_vert" size={20} color="currentColor" />
              </button>

              {/* Custom Tooltip */}
              {!showToolsMenu && (
                <div className="absolute top-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 pointer-events-none">
                  <div className="rounded-lg bg-[#0A1628] px-2 py-1.5 text-[10px] font-bold text-white shadow-xl whitespace-nowrap">
                    Инструменты
                    <div className="absolute bottom-full left-1/2 -mb-px -translate-x-1/2 border-[5px] border-transparent border-bottom-[#0A1628]" />
                  </div>
                </div>
              )}

              <BoardToolsMenu
                open={showToolsMenu}
                onClose={() => setShowToolsMenu(false)}
                onOpenMembers={() => setShowMembersModal(true)}
                onOpenCreateBoard={() => setShowCreateBoardModal(true)}
                onOpenCreateColumn={() => {
                  setColumnPrompt({
                    mode: 'create',
                    columnId: '',
                    initialValue: '',
                    initialKey: 'TODO',
                    open: true,
                  })
                  setColumnPromptValue('')
                  setColumnPromptKey('TODO')
                }}
                onOpenCreateSprint={() => setShowCreateSprintModal(true)}
                onOpenDeleteSprint={() => setShowDeleteSprintConfirm(true)}
                onOpenBackground={() => {
                  setAdvancedPanelSection('background')
                  setShowAdvancedPanel(true)
                }}
                onOpenAlemAI={() => {
                  setShowAlemAiUploadModal(true)
                  setShowToolsMenu(false)
                }}
                onOpenLabels={() => {
                  setAdvancedPanelSection('labels')
                  setShowAdvancedPanel(true)
                }}
                onOpenEditBoard={() => {
                  setEditBoardValue(boardDetails?.boardName || '')
                  setShowEditBoardModal(true)
                }}
                onOpenDeleteBoard={() => setShowDeleteBoardConfirm(true)}
                onOpenStats={handleOpenStats}
                isOwner={isBoardOwner}
                canModifyBoard={currentUserRole !== 'member'}
                canDeleteSprint={Boolean(selectedSprintId) && currentUserRole !== 'member'}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Segmented Planning Tabs */}
      {boardView === 'kanban' && boardDetails && (
        <div className="mt-3 mb-1 flex shrink-0 justify-start">
          <div className="relative inline-flex items-center gap-1 rounded-xl bg-[#0F172A]/[0.03] p-1 border border-[#0F172A]/[0.06] backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActivePlanTab('board')}
              className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                activePlanTab === 'board'
                  ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <MaterialSymbol name="view_kanban" size={16} color="currentColor" />
              <span>Доска</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlanTab('goals')}
              className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                activePlanTab === 'goals'
                  ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <MaterialSymbol name="track_changes" size={16} color="currentColor" />
              <span>Цели</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlanTab('projects')}
              className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                activePlanTab === 'projects'
                  ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <MaterialSymbol name="account_tree" size={16} color="currentColor" />
              <span>Проекты</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlanTab('sprints')}
              className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                activePlanTab === 'sprints'
                  ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              <MaterialSymbol name="directions_run" size={16} color="currentColor" />
              <span>Спринты</span>
            </button>
          </div>
        </div>
      )}

      {/* в”Ђв”Ђ Board area в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
        {/* Loading skeleton */}
        {contentIsLoading ? (
          <div className="overflow-x-auto">
            <BoardSkeleton />
          </div>
        ) : null}

        {!contentIsLoading && boardView === 'picker' && boards.length > 0 ? (
          <div className="flex flex-col">
            {/* Premium Unified Header (Stripe/Linear style) */}
            <div className="mb-8 flex flex-col gap-5 border-b border-[#0F172A]/[0.05] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-[#0A1628] sm:text-[32px]">AlemBoard</h1>
                <p className="mt-1 text-[14px] text-[#5A6F8E]">
                  Пространство задач и аналитики команды
                </p>
              </div>

              {/* Minimalist Segmented Workspace Tabs (Vercel/Linear style) */}
              <div className="relative inline-flex items-center gap-1 rounded-xl bg-[#0F172A]/[0.03] p-1 border border-[#0F172A]/[0.06] backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setPickerTab('boards')}
                  className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                    pickerTab === 'boards'
                      ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <MaterialSymbol name="grid_view" size={16} color="currentColor" />
                  <span>Доски</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('ai')}
                  className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                    pickerTab === 'ai'
                      ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <MaterialSymbol name="auto_awesome" size={16} color="currentColor" />
                  <span>ИИ-Аналитика</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab('stats')}
                  className={`flex items-center gap-2 rounded-lg px-4.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                    pickerTab === 'stats'
                      ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  <MaterialSymbol name="bar_chart" size={16} color="currentColor" />
                  <span>Общая статистика</span>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowCreateBoardModal(true)}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-4.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(30,136,229,0.25)] transition hover:bg-[#1878CA] hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MaterialSymbol name="add" size={18} color="#fff" />
                  <span>Новая доска</span>
                </button>
              </div>
            </div>

            {/* Active section rendering */}
            <div className="transition-all duration-300 ease-in-out">
              {pickerTab === 'boards' && (
                <BoardPickerGrid
                  boards={boards}
                  progressByBoardId={boardProgressById}
                  membersByBoardId={boardMembersById}
                  highlightedBoardId={window.localStorage.getItem(LAST_BOARD_KEY) ?? undefined}
                  onSelectBoard={(boardId: string) => {
                    window.localStorage.setItem(LAST_BOARD_KEY, boardId)
                    setSelectedBoardId(boardId)
                    setBoardView('kanban')
                    syncBoardUrl(boardId)
                  }}
                  onCreateBoard={() => setShowCreateBoardModal(true)}
                />
              )}

              {pickerTab === 'ai' && (
                <SingleBoardAiStatsSection
                  boards={boards}
                  users={users}
                  alemAiRepository={alemAiRepository}
                />
              )}

              {pickerTab === 'stats' && (
                <div id="global-stats-section">
                  <MultiBoardStatsSection
                    boards={boards}
                    boardController={boardController}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Kanban columns */}
        {!contentIsLoading && boardView === 'kanban' && activePlanTab === 'board' && boardDetails && filteredColumns.length > 0 ? (
          <section 
            ref={columnsScrollRef}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-auto pb-2 [scrollbar-color:rgba(0,0,0,0.12)_transparent] [scrollbar-width:thin] md:flex-row md:items-stretch md:gap-5 md:pb-4 md:snap-x md:snap-mandatory"
          >

            {filteredColumns.map((column, columnIndex) => (
              <div
                key={column.id}
                ref={(node) => {
                  setColumnCardRef(column.id, node)
                }}
                className="flex h-full min-h-0 w-full transition-transform duration-200 ease-out md:h-full md:max-h-full md:w-auto md:snap-start"
              >
                <BoardColumnCard
                  column={column}
                  columnIndex={columnIndex}
                  assigneeNamesById={knownUsersById}
                  assigneeAvatarsById={knownUserAvatarsById}
                  activeDragColumnId={dragColumnId}
                  columnDropTargetId={columnDropTargetId}
                  onColumnDragHover={(columnId) => setColumnDropTargetId(columnId)}
                  onColumnDragHoverLeave={() => setColumnDropTargetId('')}
                  onColumnDrop={(targetColumnId) => {
                    void handleColumnDrop(targetColumnId)
                  }}
                  onTaskDrop={(targetColumnId) => {
                    void handleTaskDrop(targetColumnId)
                  }}
                  onTaskDragStart={(taskId, sourceColumnId) => {
                    setDragColumnId('')
                    setColumnDropTargetId('')
                    setDragTaskState({ taskId, sourceColumnId })
                  }}
                  onTaskDragEnd={() => setDragTaskState(null)}
                  isTaskDragging={!!dragTaskState}
                  onColumnDragStart={(columnId) => {
                    setDragTaskState(null)
                    setDragColumnId(columnId)
                  }}
                  onColumnDragEnd={() => {
                    setDragColumnId('')
                    setColumnDropTargetId('')
                  }}
                  onTaskOpen={(taskId) => {
                    void openTaskDetail(taskId)
                  }}
                  onCreateTask={(columnId) => {
                    setCreateTaskColumnId(columnId)
                    setShowCreateTaskModal(true)
                  }}
                  onRenameColumn={(columnId, currentName, currentKey) => {
                    setColumnPrompt({
                      mode: 'rename',
                      columnId,
                      initialValue: currentName,
                      initialKey: currentKey,
                      open: true,
                    })
                    setColumnPromptValue(currentName)
                    setColumnPromptKey(currentKey || 'TODO')
                  }}
                  onDeleteColumn={(columnId) => {
                    if (!selectedBoardId) return
                    setDeleteColumnId(columnId)
                  }}
                  canManageTasks={currentUserRole !== 'member'}
                  canManageColumn={currentUserRole !== 'member'}
                  onLoadMore={() => void handleLoadMoreTasks(column.id)}
                  hasMore={isFilterActive ? false : columnHasMore[column.id]}
                  isLoadingMore={columnLoadingMore[column.id]}
                />
              </div>
            ))}

            {/* Add column button */}
            {currentUserRole !== 'member' && (
              <div className="md:w-[280px] md:shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedBoardId) return
                    setColumnPrompt({
                      mode: 'create',
                      columnId: '',
                      initialValue: '',
                      initialKey: 'TODO',
                      open: true,
                    })
                    setColumnPromptValue('')
                    setColumnPromptKey('TODO')
                  }}
                  className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-[#F4F4F5]/80 text-sm font-semibold text-[#9CA3AF] transition-all hover:border-[#9CA3AF] hover:bg-white hover:text-[#6B7280] active:scale-[0.98]"
                >
                  <span className="inline-flex items-center gap-2">
                    <MaterialSymbol name="add_circle" size={20} color="currentColor" />
                    Добавить колонку
                  </span>
                </button>
              </div>
            )}
          </section>
        ) : null}

        {/* Empty state */}
        {!contentIsLoading && boardView === 'kanban' && activePlanTab === 'board' && boardDetails && filteredColumns.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-sm rounded-2xl border border-dashed border-[#DDE3EE] bg-white px-8 py-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBF4FE]">
                <MaterialSymbol name="view_kanban" size={24} color="#1E88E5" />
              </div>
              <p className="text-sm font-bold text-[#0A1628]">Нет задач для отображения</p>
              <p className="mt-1.5 text-sm text-[#8497B4]">Попробуйте изменить поиск или фильтры, либо создайте новую колонку.</p>
              <button
                type="button"
                onClick={() => {
                  if (!selectedBoardId) return
                  setColumnPrompt({ mode: 'create', columnId: '', initialValue: '', initialKey: '', open: true })
                  setColumnPromptValue('')
                }}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-xs font-semibold text-white transition hover:bg-[#1878CA]"
              >
                <MaterialSymbol name="add" size={14} color="#fff" />
                Добавить колонку
              </button>
            </div>
          </div>
        ) : null}

        {/* Planning Views */}
        {!contentIsLoading && boardView === 'kanban' && activePlanTab !== 'board' && boardDetails && (
          <div className="flex-1 overflow-y-auto min-h-0 w-full rounded-2xl border border-[#0F172A]/[0.05] bg-white/70 p-6 shadow-sm backdrop-blur-md">
            {activePlanTab === 'goals' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#0A1628]">Цели доски</h2>
                    <p className="mt-0.5 text-sm text-[#5A6F8E]">Крупные ориентиры и вехи для вашей команды</p>
                  </div>
                  {currentUserRole !== 'member' ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateGoalModal(true)}
                      disabled={isMutating}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-xs font-semibold text-white transition hover:bg-[#1878CA] disabled:opacity-50"
                    >
                      <MaterialSymbol name="add" size={16} />
                      Создать цель
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 md:justify-items-start">
                    {boardDetails.goals && boardDetails.goals.length > 0 ? (
                      boardDetails.goals.map((goal, index) => {
                        const tone = GOAL_CARD_TONES[index % GOAL_CARD_TONES.length]
                        const totalTasks = goal.taskCount
                        const completedTasks = goal.completedTasks
                        const activeTasks = goal.activeTasks
                        const overdueTasks = goal.overdueTasks
                        const projectCount = goal.projectCount
                        const sprintCount = goal.sprintCount
                        const completionPercent = goal.completionPercent
                        const topProjectName = goal.topProjectName ?? ''
                        const predictionLabel = goal.predictionLabel ?? 'Нужна структура'
                        const nextActionLabel = goal.nextActionLabel ?? 'Добавьте первую задачу'

                        return (
                          <article
                            key={goal.id}
                            className={`relative w-full overflow-hidden rounded-[26px] border p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)] md:max-w-[360px] ${tone.shell}`}
                          >
                            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tone.accent }} />

                            <div className="relative flex h-full flex-col gap-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone.badge}`}>
                                      <MaterialSymbol name="track_changes" size={12} />
                                      Цель
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6F8E]">
                                      {projectCount} проектов
                                    </span>
                                  </div>

                                  <div>
                                    <h3 className="max-w-[18rem] text-[18px] font-extrabold leading-tight text-[#0A1628]">
                                      {goal.name}
                                    </h3>
                                    <p className="mt-2 line-clamp-3 min-h-[54px] text-[12px] leading-5 text-[#5A6F8E]">
                                      {goal.description?.trim() || 'Цель пока без описания. Добавьте контекст, чтобы команде было проще двигаться к результату.'}
                                    </p>
                                  </div>
                                </div>

                                {currentUserRole !== 'member' ? (
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setGoalEditState({
                                        open: true,
                                        goalId: goal.id,
                                        name: goal.name,
                                        description: goal.description ?? '',
                                      })}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[#5A6F8E] transition hover:text-[#0A1628]"
                                      title="Редактировать цель"
                                    >
                                      <MaterialSymbol name="edit" size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteGoalById(goal.id)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-100 bg-white/80 text-[#C53030] transition hover:bg-red-50"
                                      title="Удалить цель"
                                    >
                                      <MaterialSymbol name="delete" size={16} />
                                    </button>
                                  </div>
                                ) : null}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8497B4]">Задачи выполнено</p>
                                  <div className="mt-2 flex items-end justify-between gap-3">
                                    <span className="text-sm font-semibold text-[#0A1628]">
                                      {completedTasks} из {totalTasks}
                                    </span>
                                    <span className="text-lg font-extrabold text-[#0A1628]">{completionPercent}%</span>
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/70 bg-white/75 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8497B4]">Охват</p>
                                  <div className="mt-2 flex items-end justify-between gap-3">
                                    <span className="text-sm font-semibold text-[#0A1628]">{projectCount} проектов</span>
                                    <span className="text-sm font-bold text-[#5A6F8E]">{sprintCount} спринтов</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                                  <span className="text-[#8497B4]">Текущий фокус</span>
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${tone.status}`}>
                                    {predictionLabel}
                                  </span>
                                </div>
                                <p className="text-[13px] font-semibold text-[#0A1628]">{nextActionLabel}</p>
                                <div className="flex items-center gap-2 text-[11px] text-[#6B7A90]">
                                  <span className="inline-flex items-center gap-1">
                                    <MaterialSymbol name="pending_actions" size={14} />
                                    В работе: {activeTasks}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <MaterialSymbol name="warning" size={14} />
                                    Просрочено: {overdueTasks}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-auto space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[#8497B4]">
                                  <span>Общий прогресс</span>
                                  <span>{totalTasks} задач</span>
                                </div>
                                <div className={`h-2.5 overflow-hidden rounded-full ${tone.accentTrack}`}>
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${totalTasks > 0 ? Math.min(100, Math.max(6, completionPercent)) : 0}%`,
                                      background: `linear-gradient(90deg, ${tone.accent} 0%, ${tone.accent} 60%, rgba(255,255,255,0.9) 100%)`,
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-[#6B7A90]">
                                  <span>{topProjectName || 'Без ведущего проекта'}</span>
                                  <span className="font-bold text-[#0A1628]">{completionPercent}%</span>
                                </div>
                              </div>
                            </div>
                          </article>
                        )
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#DDE3EE] bg-gray-50/50 p-8 text-center">
                        <MaterialSymbol name="track_changes" size={32} className="text-[#8497B4] mx-auto mb-2" />
                        <p className="text-sm font-bold text-[#0A1628]">Нет созданных целей</p>
                        <p className="text-xs text-[#8497B4] mt-1">Добавьте цель через кнопку сверху, чтобы начать планирование</p>
                      </div>
                    )}
                </div>
              </div>
            )}

            {activePlanTab === 'projects' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#0A1628]">Проекты доски</h2>
                    <p className="text-sm text-[#5A6F8E] mt-0.5">Направления работы и инициативы, связывающие задачи</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {boardDetails.projects && boardDetails.projects.length > 0 ? (
                      boardDetails.projects.map((project) => {
                        const relatedGoal = boardDetails.goals?.find((g) => g.id === project.goalId)
                        return (
                          <div key={project.id} className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-[#0A1628]">{project.name}</h3>
                                  {relatedGoal && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-bold text-[#2E7D32]">
                                      <MaterialSymbol name="track_changes" size={12} />
                                      {relatedGoal.name}
                                    </span>
                                  )}
                                </div>
                                {project.description && (
                                  <p className="text-xs text-[#5A6F8E] mt-1 whitespace-pre-wrap">{project.description}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-start gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] px-2.5 py-1 text-xs font-semibold text-[#00897B]">
                                  <MaterialSymbol name="task_alt" size={14} />
                                  Задач: {project.taskCount}
                                </span>
                                {currentUserRole !== 'member' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setProjectEditState({
                                        open: true,
                                        projectId: project.id,
                                        name: project.name,
                                        description: project.description ?? '',
                                        goalId: project.goalId ?? '',
                                        status: project.status || 'active',
                                      })}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3EE] text-[#5A6F8E] transition hover:bg-[#F8FAFC] hover:text-[#0A1628]"
                                      title="Редактировать проект"
                                    >
                                      <MaterialSymbol name="edit" size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteProjectById(project.id)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-[#C53030] transition hover:bg-red-50"
                                      title="Удалить проект"
                                    >
                                      <MaterialSymbol name="delete" size={16} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#DDE3EE] p-8 text-center bg-gray-50/50">
                        <MaterialSymbol name="account_tree" size={32} className="text-[#8497B4] mx-auto mb-2" />
                        <p className="text-sm font-bold text-[#0A1628]">Нет созданных проектов</p>
                        <p className="text-xs text-[#8497B4] mt-1">Добавьте проект в форме справа, чтобы структурировать задачи</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-5">
                  <h3 className="font-bold text-[#0A1628] mb-4">Создать новый проект</h3>
                  <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#5A6F8E] uppercase tracking-wider mb-1">Название проекта</label>
                      <input
                        type="text"
                        required
                        placeholder="Например: Интеграция API"
                        value={projectFormName}
                        onChange={(e) => setProjectFormName(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm text-[#263238] outline-none transition placeholder:text-[#B0BEC5] focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5A6F8E] uppercase tracking-wider mb-1">Описание (необязательно)</label>
                      <textarea
                        rows={3}
                        placeholder="Опишите рамки или детали проекта..."
                        value={projectFormDescription}
                        onChange={(e) => setProjectFormDescription(e.target.value)}
                        className="w-full rounded-lg border border-[#E0E0E0] bg-white p-3 text-sm text-[#263238] outline-none transition placeholder:text-[#B0BEC5] focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#5A6F8E] uppercase tracking-wider mb-1">Привязать к цели (необязательно)</label>
                      <select
                        value={projectFormGoalId}
                        onChange={(e) => setProjectFormGoalId(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[#E0E0E0] bg-white px-2.5 text-sm text-[#263238] outline-none transition focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20"
                      >
                        <option value="">Без цели</option>
                        {boardDetails.goals?.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isMutating}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-sm font-medium text-white transition hover:bg-[#1878CA] disabled:opacity-50"
                    >
                      <MaterialSymbol name="add" size={16} />
                      Создать проект
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activePlanTab === 'sprints' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[#0A1628]">Спринты доски</h2>
                    <p className="text-sm text-[#5A6F8E] mt-0.5">Временные итерации для циклической работы вашей команды</p>
                  </div>
                  {currentUserRole !== 'member' && (
                    <button
                      type="button"
                      onClick={() => setShowCreateSprintModal(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-xs font-semibold text-white transition hover:bg-[#1878CA]"
                    >
                      <MaterialSymbol name="add" size={16} />
                      Создать спринт
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {boardDetails.sprints && boardDetails.sprints.length > 0 ? (
                    boardDetails.sprints.map((sprint) => {
                      const relatedGoal = boardDetails.goals?.find((goal) => goal.id === sprint.goalId)
                      const relatedProject = boardDetails.projects?.find((project) => project.id === sprint.projectId)

                      return (
                      <div key={sprint.id} className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-bold text-[#0A1628]">{sprint.name}</h3>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {relatedGoal ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF4FE] px-2 py-0.5 text-[10px] font-bold text-[#1E88E5]">
                                    <MaterialSymbol name="track_changes" size={12} />
                                    {relatedGoal.name}
                                  </span>
                                ) : null}
                                {relatedProject ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] px-2 py-0.5 text-[10px] font-bold text-[#00897B]">
                                    <MaterialSymbol name="account_tree" size={12} />
                                    {relatedProject.name}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${getSprintStatusMeta(sprint.status).className}`}>
                              {getSprintStatusMeta(sprint.status).label}
                            </span>
                          </div>
                        </div>

                        {currentUserRole !== 'member' && (
                          <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                            <button
                              type="button"
                              onClick={() => setSprintEditState({
                                open: true,
                                sprintId: sprint.id,
                                name: sprint.name,
                                goalId: sprint.goalId ?? '',
                                projectId: sprint.projectId ?? '',
                                status: sprint.status || 'planned',
                                startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : '',
                                endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : '',
                              })}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#DDE3EE] text-[#5A6F8E] transition hover:bg-[#F8FAFC] hover:text-[#0A1628]"
                              title="Редактировать спринт"
                            >
                              <MaterialSymbol name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSprintById(sprint.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                              title="Удалить спринт"
                            >
                              <MaterialSymbol name="delete" size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    )})
                    ) : (
                    <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-[#DDE3EE] p-8 text-center bg-gray-50/50">
                      <MaterialSymbol name="directions_run" size={32} className="text-[#8497B4] mx-auto mb-2" />
                      <p className="text-sm font-bold text-[#0A1628]">Нет созданных спринтов</p>
                      <p className="text-xs text-[#8497B4] mt-1">Добавьте спринт с помощью кнопки вверху</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No board state */}
        {!contentIsLoading && boardView === 'kanban' && !boardDetails && !isBootstrapLoading && boards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-sm rounded-2xl border border-dashed border-[#DDE3EE] bg-white px-8 py-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBF4FE]">
                <MaterialSymbol name="dashboard_customize" size={24} color="#1E88E5" />
              </div>
              <p className="text-sm font-bold text-[#0A1628]">Создайте первую доску</p>
              <p className="mt-1.5 text-sm text-[#8497B4]">Нажмите кнопку ниже, чтобы начать работу с доской.</p>
              <button
                type="button"
                onClick={() => setShowCreateBoardModal(true)}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-4 text-xs font-semibold text-white transition hover:bg-[#1878CA]"
              >
                <MaterialSymbol name="add" size={14} color="#fff" />
                Новая доска
              </button>
            </div>
          </div>
        ) : null}
      </div>
      </div>

      {showAdvancedPanel && boardDetails ? (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#0A1628]/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
            onClick={() => setShowAdvancedPanel(false)}
          />
          
          {/* Modal Content */}
          <div className="relative flex h-auto max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#D7E2F0] bg-[#F7FAFF] shadow-[0_24px_60px_rgba(10,22,40,0.3)] animate-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-[#E1EAF6] bg-white px-6 py-4">
              <div className="min-w-0">
                <p className="text-lg font-bold text-[#10233F]">Инструменты доски</p>
                <p className="text-[11px] text-[#6F86A8]">Управление фоном и метками</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedPanel(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE5F2] bg-white text-[#4D6486] transition hover:bg-[#F3F7FE] hover:text-[#1E88E5]"
                aria-label="Закрыть инструменты"
              >
                <MaterialSymbol name="close" size={20} color="currentColor" />
              </button>
            </header>

            <div className="overflow-y-auto p-6 custom-scrollbar">
              <BoardAdvancedPanel
                selectedTask={selectedTaskEntity}
                quickActionTasks={quickActionTasks}
                labels={labels}
                backgroundMode={boardDetails.background?.mode ?? ''}
                backgroundPresetId={boardDetails.background?.presetId ?? 'preset_default'}
                backgroundPresetHex={boardDetails.background?.presetHex ?? ''}
                backgroundImageUrl={boardDetails.background?.imageUrl ?? ''}
                canManageBackground={isBoardOwner}
                isBackgroundLoading={isBackgroundLoading}
                isLabelsLoading={isLabelsLoading}
                isCommentsLoading={isCommentsLoading}
                activeSection={advancedPanelSection}
                onBackgroundPreset={async (presetId) => {
                  if (!selectedBoardId || !boardDetails || !presetId) return

                  const previous = boardDetails
                  setIsBackgroundLoading(true)
                  setBoardDetails({
                    ...boardDetails,
                    background: {
                      imageUrl: '',
                      mode: 'preset_color',
                      presetHex: PRESET_HEX_MAP[presetId] ?? boardDetails.background?.presetHex ?? '',
                      presetId,
                    },
                  })

                  try {
                    await boardController.setBoardBackgroundPreset(selectedBoardId, presetId)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Фон доски обновлен')
                  } catch (err) {
                    setBoardDetails(previous)
                    setApiError(err, 'Не удалось применить пресет фона.')
                  } finally {
                    setIsBackgroundLoading(false)
                  }
                }}
                onBackgroundUpload={async (file) => {
                  if (!selectedBoardId) return
                  await runAdvanced(async () => {
                    await boardController.uploadBoardBackgroundImage(selectedBoardId, file)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Изображение фона загружено')
                  }, 'Не удалось загрузить изображение фона.', setIsBackgroundLoading)
                }}
                onBackgroundDelete={async () => {
                  if (!selectedBoardId) return
                  await runAdvanced(async () => {
                    await boardController.deleteBoardBackgroundImage(selectedBoardId)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Фон доски удален')
                  }, 'Не удалось удалить фон доски.', setIsBackgroundLoading)
                }}
                onRestoreBackgroundPreset={async () => {
                  if (!selectedBoardId) return
                  await runAdvanced(async () => {
                    await boardController.setBoardBackgroundPreset(selectedBoardId, boardDetails.background?.presetId || 'preset_default')
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Цветовой пресет восстановлен')
                  }, 'Не удалось вернуть цветовой пресет.', setIsBackgroundLoading)
                }}
                onCreateLabel={async (payload) => {
                  if (!selectedBoardId) return
                  await runAdvanced(async () => {
                    await boardController.createBoardLabel(selectedBoardId, payload)
                    setLabels(await boardController.loadBoardLabels(selectedBoardId))
                    setToast('Метка создана')
                  }, 'Не удалось создать метку.', setIsLabelsLoading)
                }}
                onDeleteLabel={async (labelId) => {
                  if (!selectedBoardId) return
                  await runAdvanced(async () => {
                    await boardController.deleteBoardLabel(selectedBoardId, labelId)
                    setLabels(await boardController.loadBoardLabels(selectedBoardId))
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Метка удалена')
                  }, 'Не удалось удалить метку.', setIsLabelsLoading)
                }}
                onAddTaskLabel={async (labelId) => {
                  if (!selectedBoardId || !selectedTaskId) return
                  await runAdvanced(async () => {
                    await boardController.addTaskLabel(selectedBoardId, selectedTaskId, labelId)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Метка добавлена к задаче')
                  }, 'Не удалось добавить метку к задаче.', setIsLabelsLoading)
                }}
                onRemoveTaskLabel={async (labelId) => {
                  if (!selectedBoardId || !selectedTaskId) return
                  await runAdvanced(async () => {
                    await boardController.removeTaskLabel(selectedBoardId, selectedTaskId, labelId)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Метка убрана из задачи')
                  }, 'Не удалось убрать метку из задачи.', setIsLabelsLoading)
                }}
                onUpdateTaskStatus={async (taskId, status) => {
                  if (!selectedBoardId || !taskId) return
                  await runAdvanced(async () => {
                    await boardController.updateTaskStatus(selectedBoardId, taskId, status)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Статус задачи обновлен')
                  }, 'Не удалось обновить статус задачи.', setIsCommentsLoading)
                }}
                onUploadAndAttachFile={async (taskId, file) => {
                  if (!selectedBoardId || !taskId) return
                  await runAdvanced(async () => {
                    const uploaded = await boardController.uploadKanbanFile(file)
                    await boardController.attachExistingFile(selectedBoardId, taskId, uploaded.fileId)
                    await loadBoard(selectedBoardId, { force: true, silent: true })
                    setToast('Файл загружен и прикреплен')
                  }, 'Не удалось прикрепить файл к задаче.', setIsCommentsLoading)
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <CreateBoardModal
        open={showCreateBoardModal}
        value={createBoardValue}
        isSubmitting={isMutating}
        onClose={() => setShowCreateBoardModal(false)}
        onChange={setCreateBoardValue}
        onSubmit={() => {
          if (!createBoardValue.trim()) return
          void (async () => {
            setIsMutating(true)
            try {
              await boardController.createBoard(createBoardValue.trim())
              setCreateBoardValue('')
              setShowCreateBoardModal(false)
              await loadBootstrap(true)
              setToast('Доска создана')
            } catch (error) {
              setApiError(error, 'Не удалось создать доску')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
      />

      <CreateTaskModal
        open={showCreateTaskModal}
        users={boardMembersAsUsers}
        sprints={boardDetails?.sprints ?? []}
        goals={boardDetails?.goals ?? []}
        projects={boardDetails?.projects ?? []}
        allLabels={labels}
        availableParentTasks={allBoardTasks}
        isSubmitting={isMutating}
        value={createTaskValue}
        uploadedAttachments={uploadedFilesForNewTask}
        onClose={() => {
          setShowCreateTaskModal(false)
          resetTaskCreate()
          setAiTaskAssistResult(null)
        }}
        onChange={setCreateTaskValue}
        onUpload={async (file) => {
          const { fileId } = await boardController.uploadKanbanFile(file)
          setUploadedFilesForNewTask((prev) => [...prev, { id: fileId, fileName: file.name }])
          setCreateTaskValue((prev) => ({
            ...prev,
            attachmentFileIds: [...prev.attachmentFileIds, fileId],
          }))
        }}
        onRemoveAttachment={(id) => {
          setUploadedFilesForNewTask((prev) => prev.filter((f) => f.id !== id))
          setCreateTaskValue((prev) => ({
            ...prev,
            attachmentFileIds: prev.attachmentFileIds.filter((fid) => fid !== id),
          }))
        }}
        onSubmit={() => {
          if (!selectedBoardId || !createTaskValue.title.trim()) return
          void (async () => {
            setIsMutating(true)
            try {
              const column = boardDetails?.columns.find((c) => c.id === createTaskColumnId)
              if (!column) {
                setApiError(new Error('Колонка не найдена'), 'Колонка, в которой вы пытаетесь создать задачу, больше не существует')
                setShowCreateTaskModal(false)
                resetTaskCreate()
                return
              }
              const columnStatus = normalizeStatusKey(column?.key)

              const newTask = await boardController.createTask(selectedBoardId, {
                title: createTaskValue.title,
                description: createTaskValue.description,
                priority: createTaskValue.priority,
                sprintId: createTaskValue.sprintId || undefined,
                goalId: createTaskValue.goalId || undefined,
                projectId: createTaskValue.projectId || undefined,
                assigneeIds: createTaskValue.assigneeIds.length > 0 ? createTaskValue.assigneeIds : undefined,
                dueAt: createTaskValue.dueAt ? `${createTaskValue.dueAt}T00:00:00Z` : undefined,
                parentId: createTaskValue.parentId || undefined,
                attachmentFileIds: createTaskValue.attachmentFileIds.length > 0 ? createTaskValue.attachmentFileIds : undefined,
                columnId: createTaskColumnId || undefined,
                status: (columnStatus && ['TODO', 'IN_PROGRESS', 'TEST', 'DONE'].includes(columnStatus)) ? columnStatus : undefined,
              })

              // Handle labels after task creation
              if (createTaskValue.labelIds.length > 0) {
                await Promise.all(
                  createTaskValue.labelIds.map((lid) => boardController.addTaskLabel(selectedBoardId, newTask.id, lid))
                )
              }

              await loadBoard(selectedBoardId, { force: true, silent: true })
              setToast('Задача создана')
              setShowCreateTaskModal(false)
              resetTaskCreate()
              setAiTaskAssistResult(null)
            } catch (error) {
              setApiError(error, 'Не удалось создать задачу')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
        onCreateBoardLabel={async (payload) => {
          if (!selectedBoardId) return
          await runAdvanced(async () => {
            await boardController.createBoardLabel(selectedBoardId, payload)
            setLabels(await boardController.loadBoardLabels(selectedBoardId))
            setToast('Метка создана')
          }, 'Не удалось создать метку.', setIsLabelsLoading)
        }}
        onAiAssist={handleTaskAiAssist}
        isAiProcessing={isAlemAiProcessing}
        onAnalyzeAssigneeWorkload={
          selectedBoardId
            ? async (payload) =>
                alemAiRepository.getKanbanAssigneeAdvice(selectedBoardId, {
                  title: payload.title,
                  description: payload.description,
                  user_id: payload.userId,
                  team_role: payload.teamRole,
                })
            : undefined
        }
      />

      {aiTaskAssistResult && (
        <AiTaskAssistModal
          open={!!aiTaskAssistResult}
          onClose={() => setAiTaskAssistResult(null)}
          onApply={handleApplyAiTaskAssist}
          original={{
            title: showCreateTaskModal ? createTaskValue.title : (selectedTaskEntity?.title || ''),
            description: showCreateTaskModal ? createTaskValue.description : (selectedTaskEntity?.description || ''),
            priority: (showCreateTaskModal ? createTaskValue.priority : selectedTaskEntity?.priority) as any,
            sprintId: showCreateTaskModal ? createTaskValue.sprintId : (selectedTaskEntity?.sprintId || ''),
            assigneeIds: showCreateTaskModal ? createTaskValue.assigneeIds : (selectedTaskEntity?.assigneeIds || []),
            dueAt: showCreateTaskModal ? createTaskValue.dueAt : (selectedTaskEntity?.dueAt ? selectedTaskEntity.dueAt.slice(0, 10) : ''),
          }}
          suggested={aiTaskAssistResult}
          sprints={boardDetails?.sprints || []}
          users={modalUsers}
        />
      )}

      <CreateSprintModal
        open={showCreateSprintModal}
        value={createSprintValue}
        goals={boardDetails?.goals ?? []}
        projects={boardDetails?.projects ?? []}
        isSubmitting={isMutating}
        onClose={() => setShowCreateSprintModal(false)}
        onChange={setCreateSprintValue}
        onSubmit={() => {
          if (!selectedBoardId || !createSprintValue.name.trim()) return
          void (async () => {
            setIsMutating(true)
            try {
              const createdSprint = await boardController.createSprint(selectedBoardId, {
                name: createSprintValue.name.trim(),
                goalId: createSprintValue.goalId || undefined,
                projectId: createSprintValue.projectId || undefined,
                status: createSprintValue.status,
                startDate: createSprintValue.startDate ? new Date(createSprintValue.startDate).toISOString() : undefined,
                endDate: createSprintValue.endDate ? new Date(createSprintValue.endDate).toISOString() : undefined,
              })
              persistSprintLinkOverride(selectedBoardId, createdSprint.id, {
                goalId: createdSprint.goalId || createSprintValue.goalId || undefined,
                projectId: createdSprint.projectId || createSprintValue.projectId || undefined,
              })
              await loadBoard(selectedBoardId, { force: true, silent: true })
              setCreateSprintValue({ name: '', goalId: '', projectId: '', status: 'planned', startDate: '', endDate: '' })
              setShowCreateSprintModal(false)
              setToast('Спринт создан')
            } catch (error) {
              setApiError(error, 'Не удалось создать спринт')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
      />

      <GoalFormModal
        open={showCreateGoalModal}
        title="Создать цель"
        confirmText="Создать"
        value={{ name: goalFormName, description: goalFormDescription }}
        isSubmitting={isMutating}
        onChange={(next) => {
          setGoalFormName(next.name)
          setGoalFormDescription(next.description)
        }}
        onClose={() => {
          setShowCreateGoalModal(false)
          setGoalFormName('')
          setGoalFormDescription('')
        }}
        onSubmit={() => {
          if (isMutating) return
          void handleCreateGoalSubmit()
        }}
      />

      <GoalFormModal
        open={goalEditState.open}
        title="Редактировать цель"
        confirmText="Сохранить"
        value={{ name: goalEditState.name, description: goalEditState.description }}
        isSubmitting={isMutating}
        onChange={(next) => setGoalEditState((prev) => ({ ...prev, name: next.name, description: next.description }))}
        onClose={() => setGoalEditState({ open: false, goalId: '', name: '', description: '' })}
        onSubmit={() => {
          if (isMutating) return
          void handleUpdateGoalSubmit()
        }}
      />

      <ProjectFormModal
        open={projectEditState.open}
        title="Редактировать проект"
        confirmText="Сохранить"
        value={{
          name: projectEditState.name,
          description: projectEditState.description,
          goalId: projectEditState.goalId,
          status: projectEditState.status,
        }}
        goals={boardDetails?.goals ?? []}
        isSubmitting={isMutating}
        onChange={(next) => setProjectEditState((prev) => ({
          ...prev,
          name: next.name,
          description: next.description,
          goalId: next.goalId,
          status: next.status,
        }))}
        onClose={() => setProjectEditState({ open: false, projectId: '', name: '', description: '', goalId: '', status: 'active' })}
        onSubmit={() => {
          if (isMutating) return
          void handleUpdateProjectSubmit()
        }}
      />

      <CreateSprintModal
        open={sprintEditState.open}
        title="Редактировать спринт"
        confirmText="Сохранить"
        value={{
          name: sprintEditState.name,
          goalId: sprintEditState.goalId,
          projectId: sprintEditState.projectId,
          status: sprintEditState.status,
          startDate: sprintEditState.startDate,
          endDate: sprintEditState.endDate,
        }}
        goals={boardDetails?.goals ?? []}
        projects={boardDetails?.projects ?? []}
        isSubmitting={isMutating}
        onClose={() => setSprintEditState({ open: false, sprintId: '', name: '', goalId: '', projectId: '', status: 'planned', startDate: '', endDate: '' })}
        onChange={(next) => setSprintEditState((prev) => ({ ...prev, ...next }))}
        onSubmit={() => {
          if (isMutating) return
          void handleUpdateSprintById()
        }}
      />

      <BoardMembersModal
        open={showMembersModal}
        members={boardDetails?.members ?? []}
        users={users}
        selectedUserId={membersSelectedUserId}
        selectedRole={membersSelectedRole}
        selectedTeamRole={membersSelectedTeamRole}
        isSubmitting={isMutating}
        onClose={() => {
          setShowMembersModal(false)
          setMembersSelectedUserId('')
          setMembersSelectedRole('member')
          setMembersSelectedTeamRole('')
        }}
        onSelectedUserIdChange={setMembersSelectedUserId}
        onSelectedRoleChange={setMembersSelectedRole}
        onSelectedTeamRoleChange={setMembersSelectedTeamRole}
        onAdd={() => {
          if (!selectedBoardId || !membersSelectedUserId) return
          void (async () => {
            setIsMutating(true)
            try {
              await boardController.addMembers(selectedBoardId, [{
                userId: Number(membersSelectedUserId),
                role: membersSelectedRole,
                teamRole: membersSelectedTeamRole.trim() || undefined,
              }])
              await loadBoard(selectedBoardId, { force: true, silent: true })
              setMembersSelectedUserId('')
              setMembersSelectedRole('member')
              setMembersSelectedTeamRole('')
              setToast('Участник добавлен')
            } catch (error) {
              setApiError(error, 'Не удалось добавить участника')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
        onRemove={(userId) => {
          if (!selectedBoardId) return
          void (async () => {
            setIsMutating(true)
            try {
              await boardController.removeMember(selectedBoardId, userId)
              await loadBoard(selectedBoardId, { force: true, silent: true })
              setToast('Участник удален')
            } catch (error) {
              setApiError(error, 'Не удалось удалить участника')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
        onUpdateRole={(userId, role) => {
          if (!selectedBoardId) return
          void (async () => {
            setIsMutating(true)
            try {
              await boardController.updateMemberRole(selectedBoardId, userId, role)
              await loadBoard(selectedBoardId, { force: true, silent: true })
              setToast('Роль обновлена')
            } catch (error) {
              setApiError(error, 'Не удалось обновить роль')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
        onUpdateTeamRole={(userId, teamRole) => {
          if (!selectedBoardId) return
          void (async () => {
            setIsMutating(true)
            try {
              await boardController.updateMemberTeamRole(selectedBoardId, userId, teamRole)
              await loadBoard(selectedBoardId, { force: true, silent: true })
              setToast('Роль в команде обновлена')
            } catch (error) {
              setApiError(error, 'Не удалось обновить роль в команде')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
        boardOwnerId={boardDetails?.ownerId ?? 0}
        currentUserId={currentUserId}
      />

      <TaskDetailModal
        key={selectedTaskId || "task"}
        open={showTaskDetailModal}
        task={selectedTaskEntity}
        users={modalUsers}
        sprints={boardDetails?.sprints ?? []}
        goals={boardDetails?.goals ?? []}
        projects={boardDetails?.projects ?? []}
        activity={activity}
        activityLoading={activityLoading}
        labels={labels}
        labelsLoading={isLabelsLoading}
        parentTask={selectedParentTask}
        availableParentTasks={parentTaskOptions}
        comments={comments}
        commentsLoading={isCommentsLoading}
        saving={isMutating}
        userRole={currentUserRole}
        onClose={() => {
          setShowTaskDetailModal(false)
          setSelectedTaskId('')
          setSelectedTaskDetails(null)
          setActivity(null)
          syncBoardUrl(selectedBoardId)
        }}
        onOpenTask={(taskId) => {
          void openTaskDetail(taskId)
        }}
        onSave={async (payload) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          setIsMutating(true)
          try {
            await boardController.updateTask(selectedTaskEntity.boardId, selectedTaskId, payload)
            await Promise.all([
              loadBoard(selectedBoardId, { force: true, silent: true }),
              refreshSelectedTaskDetails(selectedTaskId),
            ])
          } catch (error) {
            setApiError(error, 'Не удалось обновить задачу')
            throw error
          } finally {
            setIsMutating(false)
          }
        }}
        onUpdateStatus={async (status) => {
          if (!selectedBoardId || !selectedTaskId) return
          setIsMutating(true)
          try {
            await boardController.updateTaskStatus(selectedBoardId, selectedTaskId, status)
            await Promise.all([
              loadBoard(selectedBoardId, { force: true, silent: true }),
              refreshSelectedTaskDetails(selectedTaskId),
            ])
            setToast('Статус обновлен')
          } catch (error) {
            setApiError(error, 'Не удалось обновить статус')
          } finally {
            setIsMutating(false)
          }
        }}
        onDelete={() => {
          if (!selectedBoardId || !selectedTaskId) return
          setConfirmDeleteTaskOpen(true)
        }}
        onAiAssist={handleEditTaskAiAssist}
        isAiProcessing={isAlemAiProcessing}
        onUpload={async (file) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          setIsMutating(true)
          try {
            await boardController.uploadTaskFile(selectedTaskEntity.boardId, selectedTaskId, file)
            await Promise.all([
              loadBoard(selectedBoardId, { force: true, silent: true }),
              refreshSelectedTaskDetails(selectedTaskId),
            ])
            setToast('Файл прикреплен')
          } catch (error) {
            setApiError(error, 'Не удалось загрузить файл')
            throw error
          } finally {
            setIsMutating(false)
          }
        }}
        onAddWorklog={(payload) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          void (async () => {
            setIsMutating(true)
            try {
              await boardController.addWorklog(selectedTaskEntity.boardId, selectedTaskId, payload)
              const loadedActivity = await boardController.loadTaskActivity(selectedTaskId)
              setActivity(mapHistoryDetailsToColumnNames(loadedActivity))
              setToast('Worklog добавлен')
            } catch (error) {
              setApiError(error, 'Не удалось добавить worklog')
            } finally {
              setIsMutating(false)
            }
          })()
        }}
        onAddTaskLabel={async (labelId) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          await runAdvanced(async () => {
            await boardController.addTaskLabel(selectedTaskEntity.boardId, selectedTaskId, labelId)
            await Promise.all([
              loadBoard(selectedBoardId, { force: true, silent: true }),
              refreshSelectedTaskDetails(selectedTaskId),
            ])
            setToast('Метка добавлена к задаче')
          }, 'Не удалось добавить метку к задаче.', setIsLabelsLoading)
        }}
        onRemoveTaskLabel={async (labelId) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          await runAdvanced(async () => {
            await boardController.removeTaskLabel(selectedTaskEntity.boardId, selectedTaskId, labelId)
            await Promise.all([
              loadBoard(selectedBoardId, { force: true, silent: true }),
              refreshSelectedTaskDetails(selectedTaskId),
            ])
            setToast('Метка убрана из задачи')
          }, 'Не удалось убрать метку из задачи.', setIsLabelsLoading)
        }}
        onCreateComment={async (payload) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          await runAdvanced(async () => {
            await boardController.createTaskComment(selectedTaskEntity.boardId, selectedTaskId, payload)
            setComments(await boardController.loadTaskComments(selectedTaskId))
            setToast('Комментарий добавлен')
          }, 'Не удалось добавить комментарий.', setIsCommentsLoading)
        }}
        onCreatePhotoComment={async (payload) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          await runAdvanced(async () => {
            await boardController.createTaskCommentPhoto(selectedTaskEntity.boardId, selectedTaskId, payload)
            setComments(await boardController.loadTaskComments(selectedTaskId))
            setToast('Фото-комментарий добавлен')
          }, 'Не удалось добавить фото-комментарий.', setIsCommentsLoading)
        }}
        onLoadAttachment={handleLoadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        onUpdateComment={async (commentId, content) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          await runAdvanced(async () => {
            await boardController.updateComment(selectedTaskEntity.boardId, commentId, content)
            setComments(await boardController.loadTaskComments(selectedTaskId))
            setToast('Комментарий обновлен')
          }, 'Не удалось обновить комментарий.', setIsCommentsLoading)
        }}
        onDeleteComment={async (commentId) => {
          if (!selectedBoardId || !selectedTaskId || !selectedTaskEntity) return
          await runAdvanced(async () => {
            await boardController.deleteComment(selectedTaskEntity.boardId, commentId)
            setComments(await boardController.loadTaskComments(selectedTaskId))
            setToast('Комментарий удален')
          }, 'Не удалось удалить комментарий.', setIsCommentsLoading)
        }}
        onRefreshComments={() => {
          if (!selectedTaskId) return
          void (async () => {
            setIsCommentsLoading(true)
            try {
              setComments(await boardController.loadTaskComments(selectedTaskId))
            } catch (error) {
              setApiError(error, 'Не удалось обновить комментарии')
            } finally {
              setIsCommentsLoading(false)
            }
          })()
        }}
        onRefreshActivity={() => {
          if (!selectedTaskId) return
          void (async () => {
            setActivityLoading(true)
            try {
              const loadedActivity = await boardController.loadTaskActivity(selectedTaskId)
              setActivity(mapHistoryDetailsToColumnNames(loadedActivity))
            } catch (error) {
              setApiError(error, 'Не удалось обновить историю')
            } finally {
              setActivityLoading(false)
            }
          })()
        }}
        onCreateBoardLabel={async (payload) => {
          if (!selectedBoardId) return
          await runAdvanced(async () => {
            await boardController.createBoardLabel(selectedBoardId, payload)
            setLabels(await boardController.loadBoardLabels(selectedBoardId))
            setToast('Метка создана')
          }, 'Не удалось создать метку.', setIsLabelsLoading)
        }}
      />

      <CreateColumnModal
        open={columnPrompt.open}
        mode={columnPrompt.mode}
        name={columnPromptValue}
        statusKey={columnPromptKey}
        isSubmitting={isMutating}
        onNameChange={setColumnPromptValue}
        onStatusChange={setColumnPromptKey}
        onClose={() => {
          setColumnPrompt({ mode: 'create', columnId: '', initialValue: '', initialKey: '', open: false })
          setColumnPromptValue('')
          setColumnPromptKey('')
        }}
        onSubmit={() => {
          if (isMutating) return
          setIsMutating(true)
          void handleSubmitColumnPrompt().finally(() => {
            setIsMutating(false)
          })
        }}
      />

      <AppConfirmDialog
        open={Boolean(deleteColumnId)}
        title="Удаление колонки"
        message="Удалить колонку?"
        confirmText="Удалить"
        isLoading={isMutating}
        onCancel={() => setDeleteColumnId('')}
        onConfirm={() => {
          if (isMutating) return
          setIsMutating(true)
          void handleConfirmDeleteColumn().finally(() => {
            setIsMutating(false)
          })
        }}
      />

      <AppConfirmDialog
        open={confirmDeleteTaskOpen}
        title="Удаление задачи"
        message="Удалить задачу?"
        confirmText="Удалить"
        isLoading={isMutating}
        onCancel={() => setConfirmDeleteTaskOpen(false)}
        onConfirm={() => {
          if (isMutating) return
          setIsMutating(true)
          void handleConfirmDeleteTask()
        }}
      />

      <AlemAIUploadModal
        isOpen={showAlemAiUploadModal}
        onClose={() => setShowAlemAiUploadModal(false)}
        onUpload={handleAlemAiUpload}
        isProcessing={isAlemAiProcessing}
      />

      {showAiGeneratedTasks && (
        <AlemAIGeneratedTasks
          tasks={generatedAiTasks}
          kanbanContext={aiKanbanContext}
          onClose={() => setShowAiGeneratedTasks(false)}
          onConfirm={handleAlemAiConfirm}
        />
      )}
      {showEditBoardModal && (
        <AppPromptDialog
          open={showEditBoardModal}
          title="Редактировать доску"
          label="Название доски"
          value={editBoardValue}
          onConfirm={handleUpdateBoard}
          onCancel={() => setShowEditBoardModal(false)}
          onChange={setEditBoardValue}
        />
      )}

      {showDeleteBoardConfirm && (
        <AppConfirmDialog
          open={showDeleteBoardConfirm}
          title="Удалить доску"
          message={`Вы уверены, что хотите безвозвратно удалить доску "${boardDetails?.boardName}"? Все задачи в ней будут потеряны.`}
          onConfirm={handleDeleteBoard}
          onCancel={() => setShowDeleteBoardConfirm(false)}
        />
      )}

      <AppConfirmDialog
        open={showDeleteSprintConfirm}
        title="Удалить спринт"
        message={
          selectedSprintId
            ? `Удалить спринт "${boardDetails?.sprints.find((sprint) => sprint.id === selectedSprintId)?.name ?? 'Без названия'}"? У задач этого спринта привязка к спринту будет очищена.`
            : 'Сначала выберите спринт для удаления.'
        }
        confirmText="Удалить"
        isLoading={isMutating}
        onCancel={() => setShowDeleteSprintConfirm(false)}
        onConfirm={() => {
          if (!selectedSprintId || isMutating) return
          setIsMutating(true)
          void handleDeleteSprint()
        }}
      />

      {showStatsModal && boardStats && (
        <BoardStatsDashboard
          stats={boardStats}
          aiStats={aiBoardStats}
          onClose={() => {
            setShowStatsModal(false)
            setAiBoardStats(null)
          }}
        />
      )}

      <MultiBoardStatsModal
        open={showMultiStatsModal}
        onClose={() => setShowMultiStatsModal(false)}
        boards={boards}
        boardController={boardController}
      />

      {/* в”Ђв”Ђ Toast / Error strip в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      {(error || toast) ? (
        <>
          {error ? <AppToast variant="error" message={error} onClose={() => setError('')} /> : null}
          {toast ? <AppToast variant="success" message={toast} onClose={() => setToast('')} /> : null}
        </>
      ) : null}
      
    </main>
  )
}
