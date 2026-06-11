import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSmartAgentTask } from "../api/client";
import type {
  SmartAgentActionConfirmationWidget,
  SmartAgentActionItem,
  SmartAgentBaseWidget,
  SmartAgentBoardItem,
  SmartAgentBoardSelectionWidget,
  SmartAgentCalendarEventItem,
  SmartAgentEventSelectionWidget,
  SmartAgentMeetingCreatedWidget,
  SmartAgentTaskSelectionWidget,
  SmartAgentTaskItem,
  SmartAgentUserSelectionWidget,
  SmartAgentUserItem,
  SmartAgentWidget,
} from "../types";

interface SmartAgentWidgetRendererProps {
  token?: string;
  widget: SmartAgentWidget;
  isSending?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onSelect?: (selectionValue: string, displayText: string) => void;
}

const formatDateTime = (value?: string): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU");
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asArray = <T,>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

const extractList = <T,>(value: unknown, key: string): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  const obj = asObject(value);
  if (!obj) {
    return [];
  }

  return asArray<T>(obj[key]);
};

const getActionRows = (actions: Array<SmartAgentActionItem | string> = []): string[] => {
  return actions
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      return item.summary || item.tool || "";
    })
    .filter((item) => item.trim().length > 0);
};

const EmptyState = ({ text }: { text: string }) => (
  <p className="text-[12px] text-[#7A88A7]">{text}</p>
);

const WidgetShell = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-[#D7E0F0] bg-white p-3 mt-2 space-y-2">
    <p className="text-[13px] font-bold text-[#102451]">{title}</p>
    {children}
  </div>
);

const PRIORITY_LABELS: Record<string, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#FFF1F0] text-[#C53B32] border-[#F6C7C2]",
  medium: "bg-[#FFF8E8] text-[#9A6600] border-[#F3D89B]",
  low: "bg-[#EEF9F1] text-[#237A45] border-[#BEE3C7]",
};

const normalizeText = (value?: string | null): string => {
  if (!value?.trim()) {
    return "-";
  }
  return value.trim();
};

const formatPriority = (value?: string): string => {
  if (!value?.trim()) {
    return "-";
  }
  return PRIORITY_LABELS[value.trim().toLowerCase()] || value.trim();
};

const formatAssignees = (value?: Array<number | string>): string => {
  if (!Array.isArray(value) || value.length === 0) {
    return "-";
  }
  return value.map((item) => String(item)).join(", ");
};

const TaskSummaryCard = ({
  task,
  title,
}: {
  task: SmartAgentTaskItem;
  title: string;
}) => {
  const priorityKey = task.priority?.trim().toLowerCase() || "";
  const priorityClass = PRIORITY_STYLES[priorityKey] || "bg-[#F4F6FB] text-[#50607E] border-[#D7E0F0]";

  return (
    <div className="mt-2 rounded-2xl border border-[#D7E0F0] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-4 shadow-[0_10px_24px_rgba(21,54,111,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#102451]">{title}</p>
          <p className="mt-1 text-[16px] font-semibold text-[#17284D] wrap-break-word">{normalizeText(task.title)}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityClass}`}>
          {formatPriority(task.priority)}
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-[#53627F] wrap-break-word">{normalizeText(task.description)}</p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#E0E8F6] bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#7C8AA6]">Статус</p>
          <p className="mt-1 text-[12px] font-semibold text-[#1A2A50]">{normalizeText(task.status)}</p>
        </div>
        <div className="rounded-xl border border-[#E0E8F6] bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#7C8AA6]">Срок</p>
          <p className="mt-1 text-[12px] font-semibold text-[#1A2A50]">{formatDateTime(task.due_at)}</p>
        </div>
        <div className="rounded-xl border border-[#E0E8F6] bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#7C8AA6]">Исполнители</p>
          <p className="mt-1 text-[12px] font-semibold text-[#1A2A50] break-all">{formatAssignees(task.assignee_ids)}</p>
        </div>
        <div className="rounded-xl border border-[#E0E8F6] bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#7C8AA6]">ID</p>
          <p className="mt-1 text-[12px] font-semibold text-[#1A2A50] break-all">{normalizeText(task.id)}</p>
        </div>
      </div>
    </div>
  );
};

const TaskCreatedCard = ({
  token,
  title,
  task,
}: {
  token: string;
  title: string;
  task: SmartAgentTaskItem;
}) => {
  const [loadedTask, setLoadedTask] = useState<SmartAgentTaskItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const shouldLoadDetails =
    !!task.id && !task.description && !task.status && !task.due_at && (!task.assignee_ids || task.assignee_ids.length === 0);

  const resolvedTask = useMemo<SmartAgentTaskItem>(() => {
    if (loadedTask && loadedTask.id && task.id && loadedTask.id === task.id) {
      return { ...task, ...loadedTask };
    }
    return task;
  }, [loadedTask, task]);

  useEffect(() => {
    let isCancelled = false;

    if (!shouldLoadDetails || !task.id) {
      return () => {
        isCancelled = true;
      };
    }

    void getSmartAgentTask(token, task.id)
      .then((payload) => {
        if (isCancelled) {
          return;
        }
        setLoadedTask(payload);
        setLoadError(null);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setLoadedTask(null);
        setLoadError("Не удалось загрузить детали задачи.");
      });

    return () => {
      isCancelled = true;
    };
  }, [shouldLoadDetails, task.id, token]);

  return (
    <>
      <TaskSummaryCard task={resolvedTask} title={title} />
      {shouldLoadDetails && loadError ? <p className="mt-2 text-[12px] text-[#B9364A]">{loadError}</p> : null}
    </>
  );
};

const UserRow = ({ user }: { user: SmartAgentUserItem }) => (
  <div className="flex gap-2 items-center min-w-0">
    {user.avatar ? (
      <img src={user.avatar} alt={user.name || "user"} className="w-8 h-8 rounded-full object-cover" />
    ) : (
      <div className="w-8 h-8 rounded-full bg-[#DCE8FF]" />
    )}
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-semibold text-[#1A2A50] truncate">{user.name || "Без имени"}</p>
      <p className="text-[11px] text-[#6E7B98] truncate">{user.email || "-"}</p>
      <p className="text-[11px] text-[#6E7B98] truncate">{user.position || "-"}</p>
    </div>
  </div>
);

const SelectionCard = ({
  title,
  message,
  items,
  isSending,
  renderRow,
  onChoose,
}: {
  title: string;
  message?: string;
  items: Array<{ key: string; value: string; displayText: string; row: ReactNode }>;
  isSending: boolean;
  renderRow?: (item: { key: string; value: string; displayText: string; row: ReactNode }) => ReactNode;
  onChoose?: (value: string, displayText: string) => void;
}) => (
  <WidgetShell title={title}>
    {message ? <p className="text-[12px] text-[#5F6B88]">{message}</p> : null}
    {items.length === 0 ? (
      <EmptyState text="Данные для выбора отсутствуют." />
    ) : (
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={isSending || !item.value.trim()}
            onClick={() => onChoose?.(item.value, item.displayText)}
            className="w-full text-left rounded-lg border border-[#DBE4F4] bg-[#F8FBFF] p-2.5 transition-colors hover:bg-[#EEF4FF] disabled:opacity-60"
          >
            {renderRow ? renderRow(item) : item.row}
          </button>
        ))}
      </div>
    )}
  </WidgetShell>
);

const InfoListCard = ({
  title,
  items,
  renderItem,
  emptyText,
}: {
  title: string;
  items: unknown[];
  renderItem: (item: unknown, index: number) => ReactNode;
  emptyText: string;
}) => (
  <WidgetShell title={title}>
    {items.length === 0 ? <EmptyState text={emptyText} /> : <div className="space-y-2">{items.map(renderItem)}</div>}
  </WidgetShell>
);

const SuccessCard = ({ title, rows, link }: { title: string; rows: Array<[string, string]>; link?: string }) => (
  <div className="rounded-xl border border-[#C8E8D0] bg-[#F2FFF6] p-3 mt-2 text-[12px] text-[#225A32]">
    <p className="font-semibold text-[13px]">{title}</p>
    <div className="mt-1 space-y-1">
      {rows.map(([label, value]) => (
        <p key={`${label}-${value}`}>
          {label}: {value || "-"}
        </p>
      ))}
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="inline-flex text-[#1A4FAF] underline">
          Открыть
        </a>
      ) : null}
    </div>
  </div>
);

const getParticipantsText = (widgetData: SmartAgentMeetingCreatedWidget["data"]): string => {
  const participants = widgetData?.participants;
  if (typeof participants === "number") {
    return String(participants);
  }
  if (!Array.isArray(participants)) {
    return "-";
  }

  const values = participants
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      return item.name || item.email || "";
    })
    .filter(Boolean);

  return values.length > 0 ? values.join(", ") : "-";
};

export function SmartAgentWidgetRenderer({
  token = "",
  widget,
  isSending = false,
  onConfirm,
  onCancel,
  onSelect,
}: SmartAgentWidgetRendererProps) {
  switch (widget.type) {
    case "action_confirmation": {
      const typedWidget = widget as SmartAgentActionConfirmationWidget;
      const title = widget.title?.trim() || "Требуется подтверждение";
      const actions = getActionRows([...(typedWidget.data?.actions ?? []), ...(typedWidget.data?.planned_actions ?? [])]);
      return (
        <div className="rounded-xl border border-[#C9D9F8] bg-[#F4F8FF] p-3 mt-2">
          <p className="text-[13px] font-bold text-[#102451]">{title}</p>
          <p className="text-[12px] text-[#334064] mt-1">{typedWidget.data?.message || "Подтвердите выполнение действия."}</p>
          {actions.length > 0 ? (
            <ul className="mt-2 text-[12px] text-[#26355C] space-y-1">
              {actions.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              onClick={onConfirm}
              disabled={isSending}
              className="ui-primary-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
            >
              Подтвердить
            </button>
            <button
              onClick={onCancel}
              disabled={isSending}
              className="ui-ghost-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#334064] disabled:opacity-50"
            >
              Отменить
            </button>
          </div>
        </div>
      );
    }

    case "action_cancelled": {
      return (
        <div className="rounded-xl border border-[#F5C9CF] bg-[#FFF5F7] p-3 mt-2">
          <p className="text-[12px] font-semibold text-[#B9364A]">{widget.title?.trim() || "Отменено"}</p>
          <p className="text-[12px] text-[#8D2B3A] mt-1">Действие отменено.</p>
        </div>
      );
    }

    case "user_selection": {
      const typedWidget = widget as SmartAgentUserSelectionWidget;
      const users = typedWidget.data?.users ?? [];
      return (
        <SelectionCard
          title={widget.title?.trim() || "Выберите сотрудника"}
          message={typedWidget.data?.message}
          isSending={isSending}
          items={users.map((user: SmartAgentUserItem, index: number) => {
            const displayName = user.name?.trim() || user.email?.trim() || String(user.id ?? "").trim();
            const uniqueValue = user.email?.trim() || String(user.id ?? "").trim() || displayName;
            const metaText = user.email?.trim() || (user.id != null ? `ID ${user.id}` : "");
            return {
              key: `${user.id ?? "user"}-${user.email || user.name || index}`,
              value: user.selection_value?.trim() || uniqueValue,
              displayText: metaText
                ? `\u0412\u044b\u0431\u0440\u0430\u043d \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a: ${displayName} (${metaText})`
                : `\u0412\u044b\u0431\u0440\u0430\u043d \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a: ${displayName || "-"}`,
              row: (
                <div className="flex items-center gap-2">
                  <UserRow user={user} />
                  <span className="text-[11px] font-semibold text-[#1A4FAF]">Выбрать</span>
                </div>
              ),
            };
          })}
          onChoose={onSelect}
        />
      );
    }

    case "event_selection": {
      const typedWidget = widget as SmartAgentEventSelectionWidget;
      const events = typedWidget.data?.events ?? [];
      return (
        <SelectionCard
          title={widget.title?.trim() || "Выберите событие"}
          message={typedWidget.data?.message}
          isSending={isSending}
          items={events.map((event: SmartAgentCalendarEventItem, index: number) => {
            const fallback = event.title?.trim() || event.id?.trim() || "";
            return {
              key: `${event.id || "event"}-${event.title || index}`,
              value: event.selection_value?.trim() || fallback,
              displayText: `Выбрано событие: ${event.title || fallback || "-"}`,
              row: (
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#1A2A50] wrap-break-word">{event.title || "Без названия"}</p>
                    <p className="text-[11px] text-[#6E7B98]">{formatDateTime(event.start)} - {formatDateTime(event.end)}</p>
                    <p className="text-[11px] text-[#6E7B98]">Цвет: {event.color || "-"}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1A4FAF]">Выбрать</span>
                </div>
              ),
            };
          })}
          onChoose={onSelect}
        />
      );
    }

    case "task_selection": {
      const typedWidget = widget as SmartAgentTaskSelectionWidget;
      const tasks = typedWidget.data?.tasks ?? [];
      return (
        <SelectionCard
          title={widget.title?.trim() || "Выберите задачу"}
          message={typedWidget.data?.message}
          isSending={isSending}
          items={tasks.map((task: SmartAgentTaskItem, index: number) => {
            const fallback = task.title?.trim() || task.id?.trim() || "";
            return {
              key: `${task.id || "task"}-${task.title || index}`,
              value: task.selection_value?.trim() || fallback,
              displayText: `Выбрана задача: ${task.title || fallback || "-"}`,
              row: (
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#1A2A50] wrap-break-word">{task.title || "Без названия"}</p>
                    <p className="text-[11px] text-[#6E7B98]">Приоритет: {task.priority || "-"}</p>
                    <p className="text-[11px] text-[#6E7B98]">Срок: {formatDateTime(task.due_at)}</p>
                    <p className="text-[11px] text-[#6E7B98]">Доска: {task.board_id || "-"}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1A4FAF]">Выбрать</span>
                </div>
              ),
            };
          })}
          onChoose={onSelect}
        />
      );
    }

    case "board_selection": {
      const typedWidget = widget as SmartAgentBoardSelectionWidget;
      const boards = typedWidget.data?.boards ?? [];
      return (
        <SelectionCard
          title={widget.title?.trim() || "Выберите доску"}
          message={typedWidget.data?.message}
          isSending={isSending}
          items={boards.map((board: SmartAgentBoardItem, index: number) => {
            const fallback = board.name?.trim() || board.id?.trim() || "";
            return {
              key: `${board.id || "board"}-${board.name || index}`,
              value: board.selection_value?.trim() || fallback,
              displayText: `Выбрана доска: ${board.name || fallback || "-"}`,
              row: (
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#1A2A50] wrap-break-word">{board.name || "Без названия"}</p>
                    <p className="text-[11px] text-[#6E7B98]">ID: {board.id || "-"}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1A4FAF]">Выбрать</span>
                </div>
              ),
            };
          })}
          onChoose={onSelect}
        />
      );
    }

    case "user_list": {
      const users = extractList<SmartAgentUserItem>(widget.data, "users");
      return (
        <InfoListCard
          title={widget.title?.trim() || "Сотрудники"}
          items={users}
          emptyText="Сотрудники не найдены."
          renderItem={(item, index) => {
            const user = item as SmartAgentUserItem;
            return (
              <div key={`${user.id ?? "user"}-${user.email || user.name || index}`} className="rounded-lg bg-[#F8FBFF] p-2.5">
                <UserRow user={user} />
              </div>
            );
          }}
        />
      );
    }

    case "calendar_events": {
      const events = extractList<SmartAgentCalendarEventItem>(widget.data, "events");
      return (
        <InfoListCard
          title={widget.title?.trim() || "События календаря"}
          items={events}
          emptyText="События не найдены."
          renderItem={(item, index) => {
            const event = item as SmartAgentCalendarEventItem;
            return (
              <div key={`${event.id || "event"}-${event.title || index}`} className="rounded-lg bg-[#F8FBFF] p-2 text-[12px]">
                <p className="font-semibold text-[#1A2A50]">{event.title || "Без названия"}</p>
                <p className="text-[#607194]">Начало: {formatDateTime(event.start)}</p>
                <p className="text-[#607194]">Конец: {formatDateTime(event.end)}</p>
                <p className="text-[#607194]">Цвет: {event.color || "-"}</p>
              </div>
            );
          }}
        />
      );
    }

    case "event_created": {
      const typedWidget = widget as { data?: { id?: string | number; title?: string } };
      return (
        <SuccessCard
          title={widget.title?.trim() || "Событие создано"}
          rows={[
            ["Название", typedWidget.data?.title || widget.title || "-"],
            ["ID", String(typedWidget.data?.id ?? "-")],
          ]}
        />
      );
    }

    case "reminder_set": {
      const typedWidget = widget as { data?: { event_title?: string; minutes_before?: number; status?: string } };
      return (
        <SuccessCard
          title={widget.title?.trim() || "Напоминание установлено"}
          rows={[
            ["Событие", typedWidget.data?.event_title || "-"],
            ["За минут", String(typedWidget.data?.minutes_before ?? "-")],
            ["Статус", typedWidget.data?.status || "-"],
          ]}
        />
      );
    }

    case "task_created": {
      const typedWidget = widget as SmartAgentBaseWidget<"task_created", SmartAgentTaskItem | null>;
      const taskData = typedWidget.data ?? {};
      return (
        <TaskCreatedCard
          token={token}
          title={widget.title?.trim() || "\u0417\u0430\u0434\u0430\u0447\u0430 \u0441\u043e\u0437\u0434\u0430\u043d\u0430"}
          task={{
            ...taskData,
            id: taskData.id ? String(taskData.id) : undefined,
          }}
        />
      );
    }

    case "meeting_created": {
      const typedWidget = widget as SmartAgentMeetingCreatedWidget;
      return (
        <SuccessCard
          title={widget.title?.trim() || "Встреча создана"}
          rows={[
            ["Название", typedWidget.data?.title || widget.title || "-"],
            ["С", formatDateTime(typedWidget.data?.from)],
            ["По", formatDateTime(typedWidget.data?.to)],
            ["Организатор", typedWidget.data?.organizer || "-"],
            ["Участники", getParticipantsText(typedWidget.data)],
          ]}
          link={typedWidget.data?.url}
        />
      );
    }

    case "task_list": {
      const tasks = extractList<SmartAgentTaskItem>(widget.data, "tasks");
      return (
        <InfoListCard
          title={widget.title?.trim() || "Список задач"}
          items={tasks}
          emptyText="Задачи не найдены."
          renderItem={(item, index) => {
            const task = item as SmartAgentTaskItem;
            return (
              <div key={`${task.id || "task"}-${task.title || index}`} className="rounded-lg bg-[#F8FBFF] p-2 text-[12px]">
                <p className="font-semibold text-[#1A2A50]">{task.title || "Без названия"}</p>
                <p className="text-[#607194]">Приоритет: {task.priority || "-"}</p>
                <p className="text-[#607194]">Срок: {formatDateTime(task.due_at)}</p>
              </div>
            );
          }}
        />
      );
    }

    case "board_list": {
      const boards = extractList<SmartAgentBoardItem>(widget.data, "boards");
      return (
        <InfoListCard
          title={widget.title?.trim() || "Список досок"}
          items={boards}
          emptyText="Доски не найдены."
          renderItem={(item, index) => {
            const board = item as SmartAgentBoardItem;
            return (
              <div key={`${board.id || "board"}-${board.name || index}`} className="rounded-lg bg-[#F8FBFF] p-2 text-[12px]">
                <p className="font-semibold text-[#1A2A50]">{board.name || "Без названия"}</p>
              </div>
            );
          }}
        />
      );
    }

    case "my_task_summary": {
      return null;
    }

    default: {
      return (
        <WidgetShell title={widget.title?.trim() || "Неподдерживаемый widget"}>
          <p className="text-[12px] text-[#5F6B88]">Тип: {widget.type}</p>
          <pre className="mt-1 text-[11px] text-[#516082] whitespace-pre-wrap wrap-break-word bg-[#F8FBFF] border border-[#D7E0F0] rounded-lg p-2">
            {JSON.stringify(widget.data ?? null, null, 2)}
          </pre>
        </WidgetShell>
      );
    }
  }
}
