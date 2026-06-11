export interface SmartAgentChatRequest {
  message: string;
  conversation_history: unknown[];
  session_id?: string | null;
  force_new_session?: boolean;
}

export interface SmartAgentActionItem {
  tool?: string;
  summary?: string;
}

export interface SmartAgentActionConfirmationData {
  message?: string;
  actions?: Array<SmartAgentActionItem | string>;
  planned_actions?: Array<SmartAgentActionItem | string>;
}

export interface SmartAgentUserItem {
  id?: number | string;
  avatar?: string | null;
  name?: string;
  email?: string;
  position?: string | null;
  selection_value?: string;
}

export interface SmartAgentCalendarEventItem {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  color?: string;
  selection_value?: string;
}

export interface SmartAgentTaskItem {
  id?: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  due_at?: string;
  board_id?: string;
  column_id?: string;
  created_at?: string;
  updated_at?: string;
  assignee_ids?: Array<number | string>;
  selection_value?: string;
  view_url?: string;
}

export interface SmartAgentBoardItem {
  id?: string;
  name?: string;
  selection_value?: string;
}

export interface SmartAgentSelectionBaseData {
  message?: string;
  query?: string;
}

export interface SmartAgentUserSelectionData extends SmartAgentSelectionBaseData {
  users?: SmartAgentUserItem[];
}

export interface SmartAgentEventSelectionData extends SmartAgentSelectionBaseData {
  events?: SmartAgentCalendarEventItem[];
}

export interface SmartAgentTaskSelectionData extends SmartAgentSelectionBaseData {
  tasks?: SmartAgentTaskItem[];
}

export interface SmartAgentBoardSelectionData extends SmartAgentSelectionBaseData {
  boards?: SmartAgentBoardItem[];
}

export interface SmartAgentEventCreatedData {
  id?: string | number;
  title?: string;
}

export interface SmartAgentReminderSetData {
  event_id?: string | number;
  event_title?: string;
  minutes_before?: number;
  status?: string;
}

export interface SmartAgentTaskCreatedData {
  id?: string | number;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  due_at?: string;
  board_id?: string;
  column_id?: string;
  created_at?: string;
  updated_at?: string;
  assignee_ids?: Array<number | string>;
  view_url?: string;
}

export interface SmartAgentMeetingCreatedData {
  title?: string;
  from?: string;
  to?: string;
  organizer?: string;
  url?: string;
  participants?:
    | number
    | string[]
    | Array<{
        name?: string;
        email?: string;
      }>;
}

export type SmartAgentUsersListData = SmartAgentUserItem[] | { users?: SmartAgentUserItem[] };
export type SmartAgentCalendarEventsData =
  | SmartAgentCalendarEventItem[]
  | { events?: SmartAgentCalendarEventItem[] };
export type SmartAgentTaskListData = SmartAgentTaskItem[] | { tasks?: SmartAgentTaskItem[] };
export type SmartAgentBoardListData = SmartAgentBoardItem[] | { boards?: SmartAgentBoardItem[] };

export interface SmartAgentBaseWidget<TType extends string, TData> {
  type: TType;
  title?: string;
  data?: TData | null;
}

export type SmartAgentActionConfirmationWidget = SmartAgentBaseWidget<
  "action_confirmation",
  SmartAgentActionConfirmationData
>;

export type SmartAgentActionCancelledWidget = SmartAgentBaseWidget<"action_cancelled", null>;

export type SmartAgentUserSelectionWidget = SmartAgentBaseWidget<
  "user_selection",
  SmartAgentUserSelectionData
>;

export type SmartAgentEventSelectionWidget = SmartAgentBaseWidget<
  "event_selection",
  SmartAgentEventSelectionData
>;

export type SmartAgentTaskSelectionWidget = SmartAgentBaseWidget<
  "task_selection",
  SmartAgentTaskSelectionData
>;

export type SmartAgentBoardSelectionWidget = SmartAgentBaseWidget<
  "board_selection",
  SmartAgentBoardSelectionData
>;

export type SmartAgentUserListWidget = SmartAgentBaseWidget<"user_list", SmartAgentUsersListData>;

export type SmartAgentCalendarEventsWidget = SmartAgentBaseWidget<
  "calendar_events",
  SmartAgentCalendarEventsData
>;

export type SmartAgentEventCreatedWidget = SmartAgentBaseWidget<
  "event_created",
  SmartAgentEventCreatedData
>;

export type SmartAgentReminderSetWidget = SmartAgentBaseWidget<"reminder_set", SmartAgentReminderSetData>;

export type SmartAgentTaskCreatedWidget = SmartAgentBaseWidget<"task_created", SmartAgentTaskCreatedData>;

export type SmartAgentTaskListWidget = SmartAgentBaseWidget<"task_list", SmartAgentTaskListData>;

export type SmartAgentBoardListWidget = SmartAgentBaseWidget<"board_list", SmartAgentBoardListData>;

export type SmartAgentMeetingCreatedWidget = SmartAgentBaseWidget<
  "meeting_created",
  SmartAgentMeetingCreatedData
>;

export type SmartAgentKnownWidget =
  | SmartAgentActionConfirmationWidget
  | SmartAgentActionCancelledWidget
  | SmartAgentUserSelectionWidget
  | SmartAgentEventSelectionWidget
  | SmartAgentTaskSelectionWidget
  | SmartAgentBoardSelectionWidget
  | SmartAgentUserListWidget
  | SmartAgentCalendarEventsWidget
  | SmartAgentEventCreatedWidget
  | SmartAgentReminderSetWidget
  | SmartAgentTaskCreatedWidget
  | SmartAgentTaskListWidget
  | SmartAgentBoardListWidget
  | SmartAgentMeetingCreatedWidget;

export type SmartAgentUnknownWidget = SmartAgentBaseWidget<string, unknown>;

export type SmartAgentWidget = SmartAgentKnownWidget | SmartAgentUnknownWidget;

export interface SmartAgentChatResponse {
  reply: string;
  session_id: string;
  conversation_history: unknown[];
  widget: SmartAgentWidget | null;
}
