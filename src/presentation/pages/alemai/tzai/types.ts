export type TzAiPriority = "low" | "medium" | "high";

export interface TzAiTaskItem {
  title: string;
  description: string;
  priority: TzAiPriority;
  original_estimate_sec: number;
  board_id: string | null;
  column_id: string | null;
  sprint_id: string | null;
  assignee_id: number | null;
}

export interface TzAiAnalyzeResponse {
  tool?: "tzai";
  answer?: string;
  tasks: TzAiTaskItem[];
  valid_tz?: boolean;
  validation_reason?: string;
  kanban_context: Record<string, { 
    board: { id: string; name: string }; 
    columns: { column: { id: string; name: string } }[]; 
    sprints: { id: string; name: string }[]; 
    members: { user_id: number; name: string }[]; 
  }>;
}

export interface TzAiCreateTasksResponse {
  created_tasks: number;
  errors: string[];
}

export interface TzAiToolInfo {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  method: string;
  accepts_text: boolean;
  accepts_file: boolean;
  file_endpoint?: string;
}

export interface BoardOption {
  id: string;
  name: string;
}

export interface ColumnOption {
  id: string;
  name: string;
}

export interface SprintOption {
  id: string;
  name: string;
}

export interface AssigneeOption {
  id: number;
  name: string;
}

export interface BoardDetails {
  columns: ColumnOption[];
  sprints: SprintOption[];
  assignees: AssigneeOption[];
}
