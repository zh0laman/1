export interface NotesAiProofreadResponse {
  tool: 'notes_ai_proofread'
  original_text: string
  corrected_text: string
  change_summary: string[]
  used_fallback: boolean
  fallback_reason?: string | null
}

export interface NotesAiSummarizeResponse {
  tool: 'notes_ai_summarize'
  source_text: string
  summary: string
  bullets: string[]
  used_fallback: boolean
}

export interface TzAiTaskAssistResponse {
  tool: 'tzai_task_assist'
  suggested_title: string
  description: string
  acceptance_criteria: string[]
  ai_suggestion: {
    priority?: 'low' | 'medium' | 'high' | 'critical'
    sprint_id?: string
    assignee_id?: number
    due_at?: string
    changed_fields?: string[]
  } | null
  confirmation_required: boolean
  confirmation_message: string | null
}

export interface KanbanBoardStatsResponse {
  tool: 'kanban_board_stats'
  board_id: string
  board_name: string
  done_column_id: string
  stats_mode: 'workflow' | 'heuristic' | 'activity_fallback'
  timeline_metric: 'closed_tasks' | 'updated_tasks'
  period_start: string
  period_end: string
  total_closed_tasks: number
  summary: {
    total_tasks: number
    done_tasks: number
    in_progress_tasks: number
    overdue_tasks: number
    closed_this_month: number
  }
  users: Array<{
    user_id: number
    full_name: string
    assigned_tasks_count: number
    closed_tasks_count: number
    share_percent: number
    in_progress_tasks_count: number
    overdue_tasks_count: number
    on_time_closed_count: number
    late_closed_count: number
    total_time_spent_sec: number
    updated_this_week_count: number
    updated_previous_week_count: number
    weekly_delta_count: number
    commentary: string
    ai_summary: string
    tasks: any[]
  }>
  timeline: Array<{
    date: string
    closed_tasks_count: number
  }>
  calculation_note: string
}

export interface KanbanAssigneeWorkloadMember {
  user_id: number
  fio: string
  role: string
  team_role: string
  active_tasks_count: number
  in_progress_tasks_count: number
  overdue_tasks_count: number
  done_tasks_count: number
  workload_score: number
  note?: string
}

export interface KanbanAssigneeAdviceResponse {
  tool: 'kanban_assignee_advice'
  board_id: string
  can_assign: boolean
  assignee_user_id: number
  team_role: string
  rationale: string
  workload_summary: {
    board_members_total: number
    role_members_total: number
    new_task_weight: number
    proposed_assignee: KanbanAssigneeWorkloadMember
    best_in_role: KanbanAssigneeWorkloadMember | null
    role_ranking: KanbanAssigneeWorkloadMember[]
  }
  recommended_assignee: KanbanAssigneeWorkloadMember | null
  alternatives: KanbanAssigneeWorkloadMember[]
}
