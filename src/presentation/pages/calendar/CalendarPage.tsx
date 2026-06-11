import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import MaterialSymbol from "../../../shared/ui/MaterialSymbol";
import AppSelect, { type AppSelectOption } from "../../../shared/ui/AppSelect";
import AppTimePicker from "../../../shared/ui/AppTimePicker";
import AppToast from "../../../shared/ui/AppToast";
import { getErrorMessage } from "../../../shared/utils/getErrorMessage";
import { createCalendarController } from "../../calendar/createCalendarController";
import CalendarModeSwitch from "../../components/calendar/CalendarModeSwitch";
import CalendarMonthGrid from "../../components/calendar/CalendarMonthGrid";
import CalendarSkeletons from "../../components/calendar/CalendarSkeletons";
import type {
  CalendarEventViewModel,
  CalendarMode,
  CalendarViewModel,
} from "../../view-models/CalendarViewModel";
import type {
  CalendarAvailabilityResponse,
  CalendarConflictsByUser,
  CalendarRespondStatus,
  CalendarSelectableUser,
  CalendarSuggestedSlot,
  CalendarTodaySummary,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
} from "../../../domain/entities/CalendarEvent";

const emptyCalendarViewModel: CalendarViewModel = {
  host: null,
  events: [],
};

const emptyEventForm: EventFormState = {
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  isAllDay: false,
  isOnline: true,
  location: "",
  color: "#1E88E5",
  attendeeIds: [],
  reminderMinutes: "",
  recurrenceRule: "",
};

const HOUR_ROW_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }).map((_, index) => index);
const MINI_CALENDAR_MAX_DOTS = 3;
const MAX_VISIBLE_SUGGESTED_SLOTS = 3;
const REMINDER_CUSTOM_VALUE = "__custom__";
const REMINDER_PRESET_OPTIONS: AppSelectOption[] = [
  { value: "", label: "Без уведомления" },
  { value: "5", label: "За 5 минут" },
  { value: "10", label: "За 10 минут" },
  { value: "15", label: "За 15 минут" },
  { value: "30", label: "За 30 минут" },
  { value: "60", label: "За 1 час" },
  { value: REMINDER_CUSTOM_VALUE, label: "Свое значение" },
];

const RECURRENCE_OPTIONS: AppSelectOption[] = [
  { value: "", label: "Не повторяется" },
  { value: "DAILY", label: "Каждый день" },
  { value: "WEEKLY", label: "Каждую неделю" },
  { value: "MONTHLY", label: "Каждый месяц" },
];

interface PositionedEvent {
  event: CalendarEventViewModel;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

interface ActiveCalendarEdit {
  event: CalendarEventViewModel;
  occurrenceKey: string;
  mode: "move" | "resize-start" | "resize-end";
  startClientY: number;
  startClientX: number;
  originalDayKey: string;
  draftDayKey: string;
  originalStartMinutes: number;
  originalEndMinutes: number;
  draftStartMinutes: number;
  draftEndMinutes: number;
  hasChanged: boolean;
}

interface EventFormState {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  isOnline: boolean;
  location: string;
  color: string;
  attendeeIds: number[];
  reminderMinutes: string;
  recurrenceRule: string;
}

interface CalendarToastItem {
  id: number;
  message: string;
  variant: "success" | "error" | "warning";
}

interface EventAvailabilityPayload {
  startTime: string;
  endTime: string;
  attendeeIds: number[];
  excludeEventId?: string | null;
  timezone: string;
}

const getErrorStatus = (error: unknown): number | null => {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }

  return null;
};

const isReminderPresetValue = (value: string): boolean =>
  value === "" ||
  REMINDER_PRESET_OPTIONS.some(
    (option) =>
      option.value === value && option.value !== REMINDER_CUSTOM_VALUE,
  );

const getReminderEditorValue = (value: string): string =>
  isReminderPresetValue(value) ? value : REMINDER_CUSTOM_VALUE;

const getMiniCalendarEventDots = (events: CalendarEventViewModel[]) =>
  events.slice(0, MINI_CALENDAR_MAX_DOTS).map((event, index) => ({
    key: `${event.id}-${index}`,
    color: event.color || "#1E88E5",
  }));

const buildQuickReminderOptions = (value: string): AppSelectOption[] => {
  const baseOptions = REMINDER_PRESET_OPTIONS.filter(
    (option) => option.value !== REMINDER_CUSTOM_VALUE,
  );
  if (!value || isReminderPresetValue(value)) {
    return baseOptions;
  }

  return [
    baseOptions[0],
    { value, label: `За ${value} минут` },
    ...baseOptions.slice(1),
  ];
};

const getOnlineMeetingStatusLabel = (event: CalendarEventViewModel): string => {
  if (!event.isOnline) return "Оффлайн";
  if (event.joinUrl) return "Ссылка доступна";
  if (event.onlineMeetingStatus === "pending") return "Ссылка создается";
  if (event.onlineMeetingStatus === "failed")
    return "Не удалось создать ссылку";
  return "Онлайн-встреча";
};

const getOnlineMeetingProviderLabel = (
  event: CalendarEventViewModel,
): string => {
  if (!event.meetingProvider) return "Онлайн";
  if (event.meetingProvider === "livekit") return "LiveKit";
  if (event.meetingProvider === "cisco") return "Cisco";
  return event.meetingProvider;
};

const toStartOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const toEndOfDay = (date: Date): Date => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const addDays = (date: Date, days: number): Date => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const toDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const getStartOfWeek = (date: Date): Date => {
  const normalized = toStartOfDay(date);
  const day = normalized.getDay();
  const mondayShift = day === 0 ? -6 : 1 - day;
  return addDays(normalized, mondayShift);
};

const formatMonthTitle = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);

const formatDayTitle = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

const formatRangeLabel = (from: Date, to: Date): string => {
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
  const toFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${fromFormatter.format(from)} — ${toFormatter.format(to)}`;
};

const getRangeForMode = (
  mode: CalendarMode,
  anchorDate: Date,
): { from: Date; to: Date; periodLabel: string } => {
  if (mode === "month") {
    const from = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const to = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    return {
      from: toStartOfDay(from),
      to: toEndOfDay(to),
      periodLabel: formatMonthTitle(anchorDate),
    };
  }

  if (mode === "week") {
    const from = getStartOfWeek(anchorDate);
    const to = addDays(from, 6);
    return {
      from: toStartOfDay(from),
      to: toEndOfDay(to),
      periodLabel: formatRangeLabel(from, to),
    };
  }

  return {
    from: toStartOfDay(anchorDate),
    to: toEndOfDay(anchorDate),
    periodLabel: formatDayTitle(anchorDate),
  };
};

const getMonthRange = (anchorDate: Date): { from: Date; to: Date } => {
  const from = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const to = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  return {
    from: toStartOfDay(from),
    to: toEndOfDay(to),
  };
};

const buildMonthCells = (
  anchorDate: Date,
  selectedDayKey: string,
  eventsByDayKey: Record<string, CalendarEventViewModel[]>,
): Array<{
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEventViewModel[];
}> => {
  const monthStart = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1,
  );
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -firstWeekday);
  const todayKey = toDayKey(new Date());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = addDays(gridStart, index);
    const dateKey = toDayKey(date);

    return {
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === anchorDate.getMonth(),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDayKey,
      events: eventsByDayKey[dateKey] ?? [],
    };
  });
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toHourLabel = (hour: number): string => {
  const date = new Date(2025, 0, 1, hour, 0, 0);
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const toTimeRangeLabel = (
  startIso: string,
  endIso: string,
  isAllDay: boolean,
): string => {
  if (isAllDay) return "Весь день";
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
};

const getFormatterTimeZone = (timezone?: string): string | undefined => {
  if (!timezone) return undefined;
  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return undefined;
  }
};

const formatConflictDateTimeRange = (
  startIso: string,
  endIso: string,
  timezone?: string,
): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return "";
  const timeZone = getFormatterTimeZone(timezone);

  const sameDay = start.toDateString() === end.toDateString();
  const startLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(start);

  if (sameDay) {
    const endTime = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(end);
    return `${startLabel} - ${endTime}`;
  }

  const endLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(end);
  return `${startLabel} - ${endLabel}`;
};

const formatSuggestedSlotLabel = (
  startIso: string,
  endIso: string,
  timezone?: string,
): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return "";
  const timeZone = getFormatterTimeZone(timezone);

  const dayLabel = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    timeZone,
  }).format(start);
  const timeLabel = `${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone })} - ${end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone })}`;
  return `${dayLabel}, ${timeLabel}`;
};

const getDateKeyInTimeZone = (date: Date, timezone?: string): string => {
  const timeZone = getFormatterTimeZone(timezone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
};

const getSuggestedSlotKey = (slot: CalendarSuggestedSlot): string =>
  `${slot.startTime}-${slot.endTime}`;

const getSuggestedSlotBadgeLabel = (
  slot: CalendarSuggestedSlot,
  index: number,
  timezone?: string,
): string => {
  if (index === 0) return "Лучший вариант";
  if (slot.label?.trim()) return slot.label.trim();

  const start = new Date(slot.startTime);
  if (Number.isNaN(start.valueOf())) return "Свободное время";

  const now = new Date();
  const slotDayKey = getDateKeyInTimeZone(start, timezone);
  const todayKey = getDateKeyInTimeZone(now, timezone);
  const tomorrowKey = getDateKeyInTimeZone(addDays(now, 1), timezone);

  if (slotDayKey === todayKey) return "Ближайшее свободное время";
  if (slotDayKey === tomorrowKey) return "Удобное время завтра";
  return "Свободное время";
};

const sortSuggestedSlots = (
  slots: CalendarSuggestedSlot[],
): CalendarSuggestedSlot[] =>
  [...slots].sort((left, right) => {
    const leftScore =
      typeof left.score === "number" ? left.score : Number.NEGATIVE_INFINITY;
    const rightScore =
      typeof right.score === "number" ? right.score : Number.NEGATIVE_INFINITY;
    if (leftScore !== rightScore) return rightScore - leftScore;

    const leftStart = new Date(left.startTime).valueOf();
    const rightStart = new Date(right.startTime).valueOf();
    if (Number.isNaN(leftStart) || Number.isNaN(rightStart)) return 0;
    return leftStart - rightStart;
  });

const getOverlapMinutes = (
  selectedStartIso: string,
  selectedEndIso: string,
  conflictStartIso: string,
  conflictEndIso: string,
  overlapMinutes?: number,
): number => {
  if (typeof overlapMinutes === "number" && overlapMinutes > 0) {
    return overlapMinutes;
  }
  const selectedStart = new Date(selectedStartIso);
  const selectedEnd = new Date(selectedEndIso);
  const conflictStart = new Date(conflictStartIso);
  const conflictEnd = new Date(conflictEndIso);
  if (
    [selectedStart, selectedEnd, conflictStart, conflictEnd].some((value) =>
      Number.isNaN(value.valueOf()),
    )
  ) {
    return 0;
  }
  const overlapStart = Math.max(
    selectedStart.valueOf(),
    conflictStart.valueOf(),
  );
  const overlapEnd = Math.min(selectedEnd.valueOf(), conflictEnd.valueOf());
  return Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));
};

const getInitials = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.substring(0, 1).toUpperCase())
    .join("");
};

const formatParticipantCountLabel = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${count} участника`;
  return `${count} участников`;
};

const toOccurrenceKey = (event: CalendarEventViewModel): string =>
  `${event.id}__${event.dayKey}__${event.startTime}`;

const toLocalDateTimeInputValue = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toAllDayEditorInputValue = (
  iso: string,
  edge: "start" | "end",
): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return "";

  if (edge === "end") {
    date.setMilliseconds(date.getMilliseconds() - 1);
  }

  return `${toDayKey(date)}T00:00`;
};

const fromLocalDateTimeInputValue = (value: string): string => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString();
};

const toAllDayRange = (
  startInputValue: string,
  endInputValue: string,
): { startIso: string; endIso: string } | null => {
  const startDatePart = startInputValue.slice(0, 10);
  const endDatePart = endInputValue.slice(0, 10) || startDatePart;

  if (!startDatePart) return null;

  const start = new Date(`${startDatePart}T00:00`);
  const endBase = new Date(`${endDatePart}T00:00`);

  if (Number.isNaN(start.valueOf()) || Number.isNaN(endBase.valueOf())) {
    return null;
  }

  const end = new Date(endBase);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const normalizeFormForAllDay = (form: EventFormState): EventFormState => {
  const startDate = form.startAt.slice(0, 10) || toDayKey(new Date());
  const endDate = form.endAt.slice(0, 10) || startDate;

  return {
    ...form,
    isAllDay: true,
    startAt: `${startDate}T00:00`,
    endAt: `${endDate}T00:00`,
  };
};

const defaultEventDurationMs = 60 * 60 * 1000;

const parseLocalDateTimeInput = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

const getEventDurationMs = (startAt: string, endAt: string): number => {
  const start = parseLocalDateTimeInput(startAt);
  const end = parseLocalDateTimeInput(endAt);
  if (!start || !end) return defaultEventDurationMs;

  const duration = end.getTime() - start.getTime();
  return duration > 0 ? duration : defaultEventDurationMs;
};

const shiftEventStartPreservingDuration = (
  form: EventFormState,
  nextStartAt: string,
): EventFormState => {
  const nextStart = parseLocalDateTimeInput(nextStartAt);
  if (!nextStart) {
    return {
      ...form,
      startAt: nextStartAt,
    };
  }

  const nextEnd = new Date(
    nextStart.getTime() + getEventDurationMs(form.startAt, form.endAt),
  );

  return {
    ...form,
    startAt: nextStartAt,
    endAt: toLocalDateTimeInputValue(nextEnd.toISOString()),
  };
};

const getTimezoneOffsetMinutes = (): number => -new Date().getTimezoneOffset();

const layoutDayEvents = (
  events: CalendarEventViewModel[],
  dayKey: string,
  activeEdit?: ActiveCalendarEdit | null,
): PositionedEvent[] => {
  const dayStart = parseDayKey(dayKey).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const timed = events
    .filter((event) => !event.isAllDay)
    .map((event) => {
      const isEditing = activeEdit?.occurrenceKey === toOccurrenceKey(event);

      let startMinutes: number;
      let endMinutes: number;

      if (isEditing && activeEdit) {
        // If we're editing, the draft times are already day-relative (0-1440)
        // unless it's a multi-day event that was moved.
        // But for now let's use draft times if day matches.
        if (activeEdit.draftDayKey === dayKey) {
          startMinutes = activeEdit.draftStartMinutes;
          endMinutes = activeEdit.draftEndMinutes;
        } else {
          // If moved to another day, don't render on this day
          return null;
        }
      } else {
        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();

        startMinutes =
          eventStart < dayStart ? 0 : (eventStart - dayStart) / (1000 * 60);
        endMinutes =
          eventEnd > dayEnd ? 24 * 60 : (eventEnd - dayStart) / (1000 * 60);
      }

      if (startMinutes >= endMinutes) return null;

      return {
        event,
        start: Math.max(0, Math.min(startMinutes, 24 * 60 - 15)),
        end: Math.max(15, Math.min(endMinutes, 24 * 60)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const placements: Array<{
    lane: number;
    lanes: number;
    top: number;
    height: number;
    event: CalendarEventViewModel;
  }> = [];

  for (const item of timed) {
    let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[laneIndex] = item.end;
    }

    placements.push({
      lane: laneIndex,
      lanes: laneEnds.length,
      top: (item.start / 60) * HOUR_ROW_HEIGHT,
      height: Math.max(22, ((item.end - item.start) / 60) * HOUR_ROW_HEIGHT),
      event: item.event,
    });
  }

  return placements.map((placement) => ({
    event: placement.event,
    top: placement.top,
    height: placement.height,
    lane: placement.lane,
    lanes: placement.lanes,
  }));
};

export default function CalendarPage() {
  const location = useLocation();
  const processedEventIdRef = useRef<string | null>(null);
  const [viewModel, setViewModel] = useState<CalendarViewModel>(
    emptyCalendarViewModel,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hostError, setHostError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [mode, setMode] = useState<CalendarMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    toDayKey(new Date()),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEventViewModel | null>(null);
  const [selectedEventLoading, setSelectedEventLoading] = useState(false);
  const [eventPreview, setEventPreview] = useState<{
    event: CalendarEventViewModel;
    x: number;
    y: number;
  } | null>(null);
  const [isEventEditorOpen, setIsEventEditorOpen] = useState(false);
  const [eventEditorMode, setEventEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [eventForm, setEventForm] = useState<EventFormState>(emptyEventForm);
  const [searchTitle, setSearchTitle] = useState("");
  const [searchResults, setSearchResults] = useState<CalendarEventViewModel[]>(
    [],
  );
  const [searchFocusEvent, setSearchFocusEvent] =
    useState<CalendarEventViewModel | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [calendarUsers, setCalendarUsers] = useState<CalendarSelectableUser[]>(
    [],
  );
  const [calendarUsersLoading, setCalendarUsersLoading] = useState(false);
  const [calendarGuestSearch, setCalendarGuestSearch] = useState("");
  const [calendarGuestSearchResults, setCalendarGuestSearchResults] = useState<
    CalendarSelectableUser[]
  >([]);
  const [calendarSidebarSearchResults, setCalendarSidebarSearchResults] =
    useState<CalendarSelectableUser[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<
    CalendarEventViewModel[]
  >([]);
  const [todaySummary, setTodaySummary] = useState<CalendarTodaySummary | null>(
    null,
  );
  const [todayLoading, setTodayLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [availabilityResult, setAvailabilityResult] =
    useState<CalendarAvailabilityResponse | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [showAllSuggestedSlots, setShowAllSuggestedSlots] = useState(false);
  const [selectedSuggestedSlotKey, setSelectedSuggestedSlotKey] =
    useState("");
  const [conflictActionMode, setConflictActionMode] = useState<
    "create" | "update"
  >("create");
  const [toastQueue, setToastQueue] = useState<CalendarToastItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const toastIdRef = useRef(0);
  const noResultsWarnedQueryRef = useRef("");

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const pushToast = useCallback(
    (variant: "success" | "error" | "warning", message: string) => {
      const nextId = toastIdRef.current + 1;
      toastIdRef.current = nextId;
      setToastQueue((prev) => [...prev, { id: nextId, message, variant }]);
    },
    [],
  );

  const openMeetingLink = useCallback(
    (url: string) => {
      if (!url) {
        pushToast("warning", "Ссылка на онлайн-встречу пока недоступна.");
        return;
      }

      window.location.assign(url);
    },
    [pushToast],
  );

  const openMeetingInNewTab = useCallback(
    (url: string) => {
      if (!url) {
        pushToast("warning", "Ссылка на онлайн-встречу пока недоступна.");
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    },
    [pushToast],
  );

  const copyMeetingLink = useCallback(
    async (url: string) => {
      if (!url) {
        pushToast("warning", "Ссылка на онлайн-встречу пока недоступна.");
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        pushToast("success", "Ссылка на встречу скопирована.");
      } catch {
        pushToast("error", "Не удалось скопировать ссылку.");
      }
    },
    [pushToast],
  );

  useEffect(() => {
    if (!actionError) return;
    pushToast("error", actionError);
    setActionError("");
  }, [actionError, pushToast]);

  useEffect(() => {
    if (!actionSuccess) return;
    pushToast("success", actionSuccess);
    setActionSuccess("");
  }, [actionSuccess, pushToast]);

  const removeToast = useCallback((id: number) => {
    setToastQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (!targetUserId) return;
    setEventPreview(null);
    setSelectedEvent(null);
    setSelectedEventId("");
  }, [targetUserId]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return [];
    return calendarSidebarSearchResults;
  }, [calendarSidebarSearchResults, userSearch]);

  const targetUser = useMemo(
    () => calendarUsers.find((u) => u.id === targetUserId) || null,
    [calendarUsers, targetUserId],
  );
  const isReadOnlyExternalCalendar = Boolean(targetUserId);

  const { calendarController } = useMemo(() => createCalendarController(), []);

  const range = useMemo(
    () => getRangeForMode(mode, anchorDate),
    [mode, anchorDate],
  );
  const eventsLoadRange = useMemo(
    () => getMonthRange(anchorDate),
    [anchorDate],
  );

  const loadCalendar = useCallback(
    async (options?: { force?: boolean; refresh?: boolean }) => {
      const force = options?.force ?? false;
      const refresh = options?.refresh ?? false;

      if (!refresh) {
        setIsLoading(true);
      }

      const result = await calendarController.loadPage({
        fromIso: eventsLoadRange.from.toISOString(),
        toIso: eventsLoadRange.to.toISOString(),
        force,
        userId: targetUserId ?? undefined,
      });

      setViewModel(result.viewModel);
      setHostError(result.hostError);
      setEventsError(result.eventsError);

      if (!refresh) {
        setIsLoading(false);
      }
    },
    [
      calendarController,
      eventsLoadRange.from,
      eventsLoadRange.to,
      targetUserId,
    ],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadCalendar({ force: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [loadCalendar]);

  const resetEventFormForCreate = useCallback(() => {
    const now = new Date();
    const selectedDate = parseDayKey(selectedDayKey);
    const start =
      selectedDayKey === toDayKey(now) ? new Date(now) : new Date(selectedDate);

    if (selectedDayKey === toDayKey(now)) {
      start.setSeconds(0, 0);
      start.setMinutes(Math.floor(start.getMinutes() / 15) * 15);
    } else {
      start.setHours(9, 0, 0, 0);
    }

    const end = new Date(start.getTime() + defaultEventDurationMs);

    setEventForm({
      ...emptyEventForm,
      startAt: toLocalDateTimeInputValue(start.toISOString()),
      endAt: toLocalDateTimeInputValue(end.toISOString()),
    });
    setFieldErrors({});
    setAvailabilityResult(null);
  }, [selectedDayKey]);

  const handleCloseEventEditor = useCallback(() => {
    setIsEventEditorOpen(false);
    setFieldErrors({});
    setAvailabilityResult(null);
    setAvailabilityError("");
    setAvailabilityLoading(false);
    setIsConflictDialogOpen(false);
    setShowAllSuggestedSlots(false);
    setSelectedSuggestedSlotKey("");
  }, []);

  const closeConflictDialog = useCallback(() => {
    setIsConflictDialogOpen(false);
    setShowAllSuggestedSlots(false);
    setSelectedSuggestedSlotKey("");
    setAvailabilityError("");
    setAvailabilityLoading(false);
    setAvailabilityResult(null);
  }, []);

  const fillEventFormFromEvent = useCallback(
    (event: CalendarEventViewModel) => {
      setEventForm({
        title: event.title,
        description: event.description,
        startAt: event.isAllDay
          ? toAllDayEditorInputValue(event.startTime, "start")
          : toLocalDateTimeInputValue(event.startTime),
        endAt: event.isAllDay
          ? toAllDayEditorInputValue(event.endTime, "end")
          : toLocalDateTimeInputValue(event.endTime),
        isAllDay: event.isAllDay,
        isOnline: event.isOnline,
        location: event.location,
        color: event.color || "#1E88E5",
        attendeeIds: event.attendeeIds,
        reminderMinutes:
          event.reminderMinutes !== null ? String(event.reminderMinutes) : "",
        recurrenceRule: event.recurrenceRule || "",
      });

      setFieldErrors({});
      setAvailabilityResult(null);
    },
    [],
  );

  const mergeCalendarUsers = useCallback((users: CalendarSelectableUser[]) => {
    setCalendarUsers((prev) => {
      const next = new Map(prev.map((user) => [user.id, user]));
      users.forEach((user) => next.set(user.id, user));
      return Array.from(next.values());
    });
  }, []);

  const loadCalendarUsers = useCallback(
    async (query = "", target: "sidebar" | "guest" = "sidebar") => {
      setCalendarUsersLoading(true);
      try {
        const users = await calendarController.loadUsers(query);
        mergeCalendarUsers(users);
        if (target === "guest") {
          setCalendarGuestSearchResults(users);
        } else {
          setCalendarSidebarSearchResults(users);
        }
      } catch {
        if (target === "guest") {
          setCalendarGuestSearchResults([]);
        } else {
          setCalendarSidebarSearchResults([]);
        }
      } finally {
        setCalendarUsersLoading(false);
      }
    },
    [calendarController, mergeCalendarUsers],
  );

  const [activeEdit, setActiveEdit] = useState<ActiveCalendarEdit | null>(null);
  const [dragSelection, setDragSelection] = useState<{
    dayKey: string;
    startMinutes: number;
    endMinutes: number;
    startClientY: number;
    originalStartMinutes: number;
  } | null>(null);
  const suppressNextPreviewRef = useRef(false);
  const calendarBodyGridRef = useRef<HTMLDivElement | null>(null);
  const weekTimeScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const visibleDayKeysRef = useRef<string[]>([]);
  const calendarTimeColumnWidthRef = useRef(64);
  const organizerWarningAtRef = useRef(0);
  const recurringWarningAtRef = useRef(0);

  const handleColumnPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, dayKey: string) => {
      if (e.button !== 0 || isReadOnlyExternalCalendar) return;

      // Prevent default text selection or browser drag start, which cancel pointer events immediately
      e.preventDefault();
      e.stopPropagation();

      // Capture the pointer to guarantee pointermove/pointerup events are fired correctly even when dragging outside the column
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;

      const startMinRaw = clickY;
      const snappedStart = clamp(
        Math.round(startMinRaw / 15) * 15,
        0,
        24 * 60 - 15,
      );

      setDragSelection({
        dayKey,
        startMinutes: snappedStart,
        endMinutes: snappedStart + 30, // Default 30 min duration
        startClientY: e.clientY,
        originalStartMinutes: snappedStart,
      });
    },
    [isReadOnlyExternalCalendar],
  );

  useEffect(() => {
    if (!dragSelection) return;

    const handleMove = (event: PointerEvent) => {
      event.preventDefault();
      const deltaPixels = event.clientY - dragSelection.startClientY;
      const deltaMinutes = Math.round(deltaPixels / 15) * 15;

      setDragSelection((prev) => {
        if (!prev) return prev;
        let nextStart = prev.originalStartMinutes;
        let nextEnd = prev.originalStartMinutes + 30;

        if (deltaMinutes > 0) {
          nextEnd = clamp(
            prev.originalStartMinutes + deltaMinutes,
            prev.originalStartMinutes + 15,
            24 * 60,
          );
        } else if (deltaMinutes < 0) {
          nextStart = clamp(
            prev.originalStartMinutes + deltaMinutes,
            0,
            prev.originalStartMinutes - 15,
          );
          nextEnd = prev.originalStartMinutes;
        }

        return {
          ...prev,
          startMinutes: nextStart,
          endMinutes: nextEnd,
        };
      });
    };

    const handleUp = (event: PointerEvent) => {
      // Release pointer capture
      try {
        if (event.target && "releasePointerCapture" in event.target) {
          (event.target as any).releasePointerCapture(event.pointerId);
        }
      } catch {}

      const finalSelection = dragSelection;
      setDragSelection(null);

      if (isReadOnlyExternalCalendar) return;

      const selectedDate = parseDayKey(finalSelection.dayKey);
      const start = new Date(selectedDate);
      start.setHours(
        Math.floor(finalSelection.startMinutes / 60),
        finalSelection.startMinutes % 60,
        0,
        0,
      );
      const end = new Date(selectedDate);
      end.setHours(
        Math.floor(finalSelection.endMinutes / 60),
        finalSelection.endMinutes % 60,
        0,
        0,
      );

      setEventForm({
        ...emptyEventForm,
        startAt: toLocalDateTimeInputValue(start.toISOString()),
        endAt: toLocalDateTimeInputValue(end.toISOString()),
      });
      setFieldErrors({});
      setAvailabilityResult(null);
      setEventPreview(null);
      setSelectedEventId("");
      setSelectedEvent(null);
      setEventEditorMode("create");
      setIsEventEditorOpen(true);
      setActionError("");
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragSelection, isReadOnlyExternalCalendar]);

  const openCreateEventEditor = useCallback(() => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }

    setEventPreview(null);
    setSelectedEventId("");
    setSelectedEvent(null);
    resetEventFormForCreate();
    setEventEditorMode("create");
    setIsEventEditorOpen(true);
    setActionError("");
    setAvailabilityError("");
    setIsConflictDialogOpen(false);
    setShowAllSuggestedSlots(false);
    setSelectedSuggestedSlotKey("");
  }, [isReadOnlyExternalCalendar, resetEventFormForCreate]);

  const openEditEventEditor = useCallback(
    (eventToEdit?: CalendarEventViewModel | null) => {
      if (isReadOnlyExternalCalendar) {
        setActionError(
          "Можно только просматривать календарь другого пользователя.",
        );
        return;
      }

      const sourceEvent =
        eventToEdit ?? selectedEvent ?? eventPreview?.event ?? null;
      if (!sourceEvent?.id) {
        setActionError(
          "Не удалось определить событие для редактирования. Выберите событие заново.",
        );
        return;
      }

      setSelectedEventId(sourceEvent.id);
      setSelectedEvent(sourceEvent);
      fillEventFormFromEvent(sourceEvent);
      setEventEditorMode("edit");
      setIsEventEditorOpen(true);
      setEventPreview(null);
      setActionError("");
      setAvailabilityError("");
      setIsConflictDialogOpen(false);
      setShowAllSuggestedSlots(false);
      setSelectedSuggestedSlotKey("");
    },
    [
      eventPreview,
      fillEventFormFromEvent,
      isReadOnlyExternalCalendar,
      selectedEvent,
    ],
  );

  const persistEventTimeChange = useCallback(
    async (
      calendarEvent: CalendarEventViewModel,
      startMinutes: number,
      endMinutes: number,
      dayKey: string,
    ) => {
      const dayDate = parseDayKey(dayKey);
      const newStart = new Date(dayDate);
      newStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      const newEnd = new Date(dayDate);
      newEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

      await calendarController.updateEvent(calendarEvent.id, {
        title: calendarEvent.title,
        description: calendarEvent.description,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        attendeeIds: calendarEvent.attendeeIds,
        isAllDay: calendarEvent.isAllDay,
        isOnline: calendarEvent.isOnline,
        location: calendarEvent.location,
        color: calendarEvent.color,
        reminderMinutes:
          calendarEvent.reminderMinutes !== null
            ? calendarEvent.reminderMinutes
            : undefined,
        recurrenceRule: calendarEvent.recurrenceRule,
        recurrenceInterval:
          calendarEvent.recurrenceInterval !== null
            ? calendarEvent.recurrenceInterval
            : undefined,
        recurrenceUntil: calendarEvent.recurrenceUntil,
      });
    },
    [calendarController],
  );

  const startPointerEdit = useCallback(
    (
      pointerEvent: React.PointerEvent,
      calendarEvent: CalendarEventViewModel,
      mode: ActiveCalendarEdit["mode"],
      clickedDayKey?: string,
    ) => {
      const targetDayKey = clickedDayKey || calendarEvent.dayKey;
      const dayStart = parseDayKey(targetDayKey).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      if (isReadOnlyExternalCalendar) {
        return;
      }
      if (!calendarEvent.isOrganizer) {
        const now = Date.now();
        if (now - organizerWarningAtRef.current > 1200) {
          setActionError("Только организатор может редактировать эту встречу");
          organizerWarningAtRef.current = now;
        }
        return;
      }

      if (calendarEvent.isAllDay) {
        return;
      }

      if (false && calendarEvent.recurrenceRule) {
        const now = Date.now();
        if (now - recurringWarningAtRef.current > 2500) {
          setActionError(
            "Это повторяющаяся встреча: изменения времени применятся ко всей серии событий.",
          );
          recurringWarningAtRef.current = now;
        }
      }

      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();

      const eventStart = new Date(calendarEvent.startTime).getTime();
      const eventEnd = new Date(calendarEvent.endTime).getTime();

      const originalStartMinutes =
        eventStart < dayStart ? 0 : (eventStart - dayStart) / (1000 * 60);
      const originalEndMinutes =
        eventEnd > dayEnd ? 24 * 60 : (eventEnd - dayStart) / (1000 * 60);

      setActiveEdit({
        event: calendarEvent,
        occurrenceKey: toOccurrenceKey(calendarEvent),
        mode,
        startClientY: pointerEvent.clientY,
        startClientX: pointerEvent.clientX,
        originalDayKey: targetDayKey,
        draftDayKey: targetDayKey,
        originalStartMinutes,
        originalEndMinutes,
        draftStartMinutes: originalStartMinutes,
        draftEndMinutes: originalEndMinutes,
        hasChanged: false,
      });
    },
    [isReadOnlyExternalCalendar],
  );

  useEffect(() => {
    if (!activeEdit) return;

    const handleMove = (event: PointerEvent) => {
      event.preventDefault();
      setActiveEdit((prev) => {
        if (!prev) return prev;
        const deltaPixels = event.clientY - prev.startClientY;
        const rawDeltaMinutes = (deltaPixels / HOUR_ROW_HEIGHT) * 60;
        const snappedDelta = Math.round(rawDeltaMinutes / 15) * 15;

        const duration = prev.originalEndMinutes - prev.originalStartMinutes;
        let nextStart = prev.originalStartMinutes;
        let nextEnd = prev.originalEndMinutes;
        let nextDayKey = prev.draftDayKey;

        if (prev.mode === "move") {
          nextStart = clamp(
            prev.originalStartMinutes + snappedDelta,
            0,
            24 * 60 - duration,
          );
          nextEnd = nextStart + duration;

          if (
            calendarBodyGridRef.current &&
            visibleDayKeysRef.current.length > 1
          ) {
            const rect = calendarBodyGridRef.current.getBoundingClientRect();
            const dayColWidth = calendarTimeColumnWidthRef.current;
            const daysAreaLeft = rect.left + dayColWidth;
            const daysAreaWidth = Math.max(1, rect.width - dayColWidth);
            const dayWidth = daysAreaWidth / visibleDayKeysRef.current.length;
            const x = event.clientX - daysAreaLeft;
            const rawIndex = Math.floor(x / dayWidth);
            const dayIndex = clamp(
              rawIndex,
              0,
              visibleDayKeysRef.current.length - 1,
            );
            nextDayKey =
              visibleDayKeysRef.current[dayIndex] ?? prev.draftDayKey;
          }
        } else if (prev.mode === "resize-start") {
          nextStart = clamp(
            prev.originalStartMinutes + snappedDelta,
            0,
            prev.originalEndMinutes - 15,
          );
          nextEnd = prev.originalEndMinutes;
        } else {
          nextStart = prev.originalStartMinutes;
          nextEnd = clamp(
            prev.originalEndMinutes + snappedDelta,
            prev.originalStartMinutes + 15,
            24 * 60,
          );
        }

        const nextState = {
          ...prev,
          draftDayKey: nextDayKey,
          draftStartMinutes: nextStart,
          draftEndMinutes: nextEnd,
          hasChanged:
            nextStart !== prev.originalStartMinutes ||
            nextEnd !== prev.originalEndMinutes ||
            nextDayKey !== prev.originalDayKey,
        };

        return nextState;
      });
    };

    const handleUp = () => {
      const edit = activeEdit;
      if (!edit?.hasChanged) {
        setActiveEdit(null);
        return;
      }

      // Optimistic UI update: keep new slot immediately and avoid visual rollback before server refresh.
      const nextDayDate = parseDayKey(edit.draftDayKey);
      const nextStart = new Date(nextDayDate);
      nextStart.setHours(
        Math.floor(edit.draftStartMinutes / 60),
        edit.draftStartMinutes % 60,
        0,
        0,
      );
      const nextEnd = new Date(nextDayDate);
      nextEnd.setHours(
        Math.floor(edit.draftEndMinutes / 60),
        edit.draftEndMinutes % 60,
        0,
        0,
      );
      const nextStartIso = nextStart.toISOString();
      const nextEndIso = nextEnd.toISOString();

      setViewModel((prev) => ({
        ...prev,
        events: prev.events.map((event) =>
          toOccurrenceKey(event) === edit.occurrenceKey
            ? {
                ...event,
                dayKey: edit.draftDayKey,
                startTime: nextStartIso,
                endTime: nextEndIso,
                timeLabel: toTimeRangeLabel(
                  nextStartIso,
                  nextEndIso,
                  event.isAllDay,
                ),
              }
            : event,
        ),
      }));

      setActiveEdit(null);
      suppressNextPreviewRef.current = true;
      void (async () => {
        try {
          await persistEventTimeChange(
            edit.event,
            edit.draftStartMinutes,
            edit.draftEndMinutes,
            edit.draftDayKey,
          );
          await loadCalendar({ refresh: true });
          setActionSuccess("Событие обновлено");
        } catch (error) {
          // Rollback optimistic update when backend rejects edit.
          setViewModel((prev) => ({
            ...prev,
            events: prev.events.map((event) =>
              toOccurrenceKey(event) === edit.occurrenceKey
                ? {
                    ...event,
                    dayKey: edit.event.dayKey,
                    startTime: edit.event.startTime,
                    endTime: edit.event.endTime,
                    timeLabel: edit.event.timeLabel,
                  }
                : event,
            ),
          }));
          setActionError(
            getErrorMessage(error, "Не удалось изменить время события"),
          );
        }
      })();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [activeEdit, loadCalendar, persistEventTimeChange]);

  const handleDrop = useCallback(
    async (event: React.DragEvent, dayKey: string) => {
      event.preventDefault();
      const data = event.dataTransfer.getData("calendar-event");
      if (!data) return;

      const calendarEvent: CalendarEventViewModel = JSON.parse(data);
      const rect = event.currentTarget.getBoundingClientRect();
      // Use clientY because offsetY might be relative to child elements
      const offsetY = event.clientY - rect.top;

      // Calculate minutes from vertical offset
      const totalMinutes = (offsetY / HOUR_ROW_HEIGHT) * 60;
      // Snap to 15 minute increments
      const snappedMinutes = Math.round(totalMinutes / 15) * 15;

      const dayDate = parseDayKey(dayKey);
      const newStart = new Date(dayDate);
      newStart.setHours(
        Math.floor(snappedMinutes / 60),
        snappedMinutes % 60,
        0,
        0,
      );

      const oldStart = new Date(calendarEvent.startTime);
      const oldEnd = new Date(calendarEvent.endTime);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const newEnd = new Date(newStart.getTime() + durationMs);

      try {
        await calendarController.updateEvent(calendarEvent.id, {
          title: calendarEvent.title,
          description: calendarEvent.description,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          attendeeIds: calendarEvent.attendeeIds,
          isAllDay: calendarEvent.isAllDay,
          isOnline: calendarEvent.isOnline,
          location: calendarEvent.location,
          color: calendarEvent.color,
          reminderMinutes:
            calendarEvent.reminderMinutes !== null
              ? calendarEvent.reminderMinutes
              : undefined,
          recurrenceRule: calendarEvent.recurrenceRule,
          recurrenceInterval:
            calendarEvent.recurrenceInterval !== null
              ? calendarEvent.recurrenceInterval
              : undefined,
          recurrenceUntil: calendarEvent.recurrenceUntil,
        });
        void loadCalendar({ refresh: true });
        setActionSuccess("Встреча перемещена");
      } catch (err) {
        setActionError(getErrorMessage(err, "Не удалось переместить встречу"));
      }
    },
    [calendarController, loadCalendar],
  );

  const loadSecondaryData = useCallback(async () => {
    setTodayLoading(true);
    try {
      const [upcoming, today] = await Promise.all([
        calendarController.loadUpcomingEvents(5),
        calendarController.loadTodaySummary(getTimezoneOffsetMinutes()),
      ]);
      setUpcomingEvents(
        upcoming.map((event) =>
          calendarController.toEventViewModel(event, viewModel.host?.id),
        ),
      );
      setTodaySummary(today);
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          "Не удалось загрузить дополнительные данные календаря.",
        ),
      );
    } finally {
      setTodayLoading(false);
    }
  }, [calendarController]);

  useEffect(() => {
    void loadSecondaryData();
  }, [loadSecondaryData]);

  useEffect(() => {
    void loadCalendarUsers("", "sidebar");
    void loadCalendarUsers("", "guest");
  }, [loadCalendarUsers]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCalendarUsers(userSearch.trim(), "sidebar");
    }, 250);

    return () => window.clearTimeout(handle);
  }, [loadCalendarUsers, userSearch]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCalendarUsers(calendarGuestSearch.trim(), "guest");
    }, 250);

    return () => window.clearTimeout(handle);
  }, [calendarGuestSearch, loadCalendarUsers]);

  useEffect(() => {
    if (!isEventEditorOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isConflictDialogOpen) {
          closeConflictDialog();
          return;
        }
        handleCloseEventEditor();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeConflictDialog,
    handleCloseEventEditor,
    isConflictDialogOpen,
    isEventEditorOpen,
  ]);

  const selectEvent = useCallback(
    async (eventId: string) => {
      setSelectedEventId(eventId);
      setSelectedEventLoading(true);
      setActionError("");
      try {
        const loaded =
          typeof targetUserId === "number"
            ? await calendarController.getUserEvent(targetUserId, eventId)
            : await calendarController.getEvent(eventId);
        const view = calendarController.toEventViewModel(
          loaded,
          viewModel.host?.id,
        );
        setSelectedEvent(view);
        fillEventFormFromEvent(view);
      } catch (error) {
        setActionError(
          getErrorMessage(error, "Не удалось загрузить детали события."),
        );
      } finally {
        setSelectedEventLoading(false);
      }
    },
    [calendarController, fillEventFormFromEvent, targetUserId],
  );

  const openEventPreview = useCallback(
    (event: CalendarEventViewModel, clientX?: number, clientY?: number) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const cardWidth = 360;
      const cardHeight = 240;
      const baseX = typeof clientX === "number" ? clientX : viewportWidth / 2;
      const baseY = typeof clientY === "number" ? clientY : viewportHeight / 2;
      const x = Math.max(16, Math.min(baseX, viewportWidth - cardWidth - 16));
      const y = Math.max(16, Math.min(baseY, viewportHeight - cardHeight - 16));

      setEventPreview({ event, x, y });
      if (selectedEventId !== event.id) {
        void selectEvent(event.id);
      }
    },
    [selectEvent, selectedEventId],
  );

  useEffect(() => {
    if (!searchFocusEvent || !searchTitle.trim()) return;

    const eventDate = parseDayKey(searchFocusEvent.dayKey);
    if (selectedDayKey !== searchFocusEvent.dayKey) {
      setSelectedDayKey(searchFocusEvent.dayKey);
    }
    if (toDayKey(anchorDate) !== searchFocusEvent.dayKey) {
      setAnchorDate(eventDate);
    }
    openEventPreview(searchFocusEvent);
    setSearchFocusEvent(null);
  }, [
    anchorDate,
    openEventPreview,
    searchFocusEvent,
    searchTitle,
    selectedDayKey,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const eventId = params.get("event") || params.get("eventId");
    if (!eventId) {
      processedEventIdRef.current = null;
      return;
    }

    if (!viewModel.events.length) return;
    if (processedEventIdRef.current === eventId) return;
    processedEventIdRef.current = eventId;

    const match = viewModel.events.find((e) => e.id === eventId);
    if (match) {
      const eventDate = parseDayKey(match.dayKey);
      setSelectedDayKey(match.dayKey);
      setAnchorDate(eventDate);
      openEventPreview(match);

      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete("event");
      cleanParams.delete("eventId");
      const searchStr = cleanParams.toString();
      window.history.replaceState(
        null,
        "",
        `${location.pathname}${searchStr ? "?" + searchStr : ""}`,
      );
    } else {
      let isCancelled = false;
      void calendarController
        .getEvent(eventId)
        .then((loaded) => {
          if (isCancelled) return;
          const view = calendarController.toEventViewModel(
            loaded,
            viewModel.host?.id,
          );
          const eventDate = parseDayKey(view.dayKey);
          setSelectedDayKey(view.dayKey);
          setAnchorDate(eventDate);
          openEventPreview(view);

          const cleanParams = new URLSearchParams(location.search);
          cleanParams.delete("event");
          cleanParams.delete("eventId");
          const searchStr = cleanParams.toString();
          window.history.replaceState(
            null,
            "",
            `${location.pathname}${searchStr ? "?" + searchStr : ""}`,
          );
        })
        .catch((err) => {
          console.error(
            "Failed to pre-select event from URL query parameter",
            err,
          );
        });
      return () => {
        isCancelled = true;
      };
    }
  }, [
    location.search,
    viewModel.events,
    viewModel.host?.id,
    calendarController,
    openEventPreview,
  ]);

  const toEventPayload = useCallback(():
    | CreateCalendarEventPayload
    | UpdateCalendarEventPayload
    | null => {
    const allDayRange = eventForm.isAllDay
      ? toAllDayRange(eventForm.startAt, eventForm.endAt)
      : null;
    const startIso =
      allDayRange?.startIso ?? fromLocalDateTimeInputValue(eventForm.startAt);
    const endIso =
      allDayRange?.endIso ?? fromLocalDateTimeInputValue(eventForm.endAt);

    const newErrors: Record<string, boolean> = {};
    if (!eventForm.title.trim()) newErrors.title = true;
    if (!eventForm.startAt) newErrors.startAt = true;
    if (!eventForm.endAt) newErrors.endAt = true;

    setFieldErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setActionError("Заполните обязательные поля.");
      return null;
    }

    if (new Date(endIso).valueOf() <= new Date(startIso).valueOf()) {
      setActionError("Дата завершения должна быть позже даты начала.");
      setFieldErrors({ endAt: true });
      return null;
    }

    if (eventForm.reminderMinutes) {
      const reminderMinutes = Number(eventForm.reminderMinutes);
      if (!Number.isFinite(reminderMinutes) || reminderMinutes < 0) {
        setActionError("Укажите корректное время уведомления в минутах.");
        return null;
      }
    }

    return {
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      startTime: startIso,
      endTime: endIso,
      attendeeIds: eventForm.attendeeIds,
      isAllDay: eventForm.isAllDay,
      isOnline: eventForm.isOnline,
      location: eventForm.location.trim(),
      color: eventForm.color || "#1E88E5",
      reminderMinutes: eventForm.reminderMinutes
        ? Number(eventForm.reminderMinutes)
        : undefined,
      recurrenceRule: eventForm.recurrenceRule || undefined,
    };
  }, [eventForm]);

  const buildAvailabilityPayload =
    useCallback((): EventAvailabilityPayload | null => {
      const allDayRange = eventForm.isAllDay
        ? toAllDayRange(eventForm.startAt, eventForm.endAt)
        : null;
      const startIso =
        allDayRange?.startIso ?? fromLocalDateTimeInputValue(eventForm.startAt);
      const endIso =
        allDayRange?.endIso ?? fromLocalDateTimeInputValue(eventForm.endAt);

      if (!startIso || !endIso) return null;
      if (new Date(endIso).valueOf() <= new Date(startIso).valueOf())
        return null;
      if (!eventForm.attendeeIds.length) return null;

      return {
        startTime: startIso,
        endTime: endIso,
        attendeeIds: eventForm.attendeeIds ?? [],
        excludeEventId:
          eventEditorMode === "edit" ? selectedEventId || null : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      };
    }, [eventEditorMode, eventForm, selectedEventId]);

  const findConflictingEvent = useCallback(
    (
      _payload: CreateCalendarEventPayload | UpdateCalendarEventPayload,
      _options?: { excludeEventId?: string },
    ): CalendarEventViewModel | null => {
      // Overlapping events are allowed, so local availability check is bypassed
      return null;
    },
    [],
  );

  const filteredEvents = useMemo(() => {
    if (!searchTitle.trim()) {
      return viewModel.events;
    }
    return searchResults;
  }, [searchResults, searchTitle, viewModel.events]);

  const normalizedSelectedDayKey = useMemo(() => {
    const currentSelected = parseDayKey(selectedDayKey);
    if (currentSelected < range.from || currentSelected > range.to) {
      return toDayKey(range.from);
    }

    return selectedDayKey;
  }, [range.from, range.to, selectedDayKey]);

  const eventsByDayKey = useMemo(() => {
    return filteredEvents.reduce<Record<string, CalendarEventViewModel[]>>(
      (acc, event) => {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);

        let current = toStartOfDay(start);
        const last = toStartOfDay(end);

        // Ensure we at least add it to the primary dayKey if dates are weird
        if (current > last) {
          const bucket = acc[event.dayKey] ?? [];
          bucket.push(event);
          acc[event.dayKey] = bucket;
          return acc;
        }

        while (current <= last) {
          const key = toDayKey(current);
          const bucket = acc[key] ?? [];
          bucket.push(event);
          acc[key] = bucket;
          current = addDays(current, 1);
        }
        return acc;
      },
      {},
    );
  }, [filteredEvents]);

  const monthCells = useMemo(
    () => buildMonthCells(anchorDate, normalizedSelectedDayKey, eventsByDayKey),
    [anchorDate, normalizedSelectedDayKey, eventsByDayKey],
  );

  const miniCalendarCells = useMemo(
    () => buildMonthCells(anchorDate, normalizedSelectedDayKey, eventsByDayKey),
    [anchorDate, normalizedSelectedDayKey, eventsByDayKey],
  );

  const visibleDayKeys = useMemo(() => {
    if (mode === "day") {
      return [normalizedSelectedDayKey];
    }

    if (mode === "week") {
      const start = getStartOfWeek(anchorDate);
      return Array.from({ length: 7 }).map((_, index) =>
        toDayKey(addDays(start, index)),
      );
    }

    return [];
  }, [anchorDate, mode, normalizedSelectedDayKey]);

  const positionedByDay = useMemo(() => {
    const map: Record<string, PositionedEvent[]> = {};
    for (const dayKey of visibleDayKeys) {
      map[dayKey] = layoutDayEvents(
        eventsByDayKey[dayKey] ?? [],
        dayKey,
        activeEdit,
      );
    }
    return map;
  }, [activeEdit, eventsByDayKey, visibleDayKeys]);

  const mobilePositionedEvents = useMemo(() => {
    return layoutDayEvents(
      eventsByDayKey[normalizedSelectedDayKey] ?? [],
      normalizedSelectedDayKey,
      activeEdit,
    );
  }, [activeEdit, eventsByDayKey, normalizedSelectedDayKey]);

  const allDayEventsByDay = useMemo(() => {
    const map: Record<string, CalendarEventViewModel[]> = {};
    for (const dayKey of visibleDayKeys) {
      map[dayKey] = (eventsByDayKey[dayKey] ?? []).filter(
        (event) => event.isAllDay,
      );
    }
    return map;
  }, [eventsByDayKey, visibleDayKeys]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDayKey[normalizedSelectedDayKey] ?? [];
  }, [eventsByDayKey, normalizedSelectedDayKey]);

  const handleToday = () => {
    const now = new Date();
    setAnchorDate(now);
    setSelectedDayKey(toDayKey(now));
  };

  const handlePrev = () => {
    if (mode === "month") {
      setAnchorDate(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
      );
      return;
    }

    if (mode === "week") {
      setAnchorDate((prev) => addDays(prev, -7));
      return;
    }

    setAnchorDate((prev) => addDays(prev, -1));
  };

  const handleNext = () => {
    if (mode === "month") {
      setAnchorDate(
        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
      );
      return;
    }

    if (mode === "week") {
      setAnchorDate((prev) => addDays(prev, 7));
      return;
    }

    setAnchorDate((prev) => addDays(prev, 1));
  };

  const handleCreateEvent = async (force = false) => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }
    setActionLoading(true);
    const payload = toEventPayload();
    if (!payload) {
      setActionLoading(false);
      return;
    }

    const conflictingEvent = findConflictingEvent(payload);
    if (conflictingEvent) {
      setActionError(
        `Это время уже занято: «${conflictingEvent.title}» (${conflictingEvent.timeLabel}).`,
      );
      setActionLoading(false);
      return;
    }

    setActionError("");
    try {
      if (!force) {
        const availability = await runAvailabilityCheck({
          startTime: payload.startTime,
          endTime: payload.endTime,
          attendeeIds: payload.attendeeIds ?? [],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
        if (!availability) {
          setActionError(
            "Не удалось проверить доступность участников. Попробуйте позже.",
          );
          return;
        }
        if (!availability.isAvailable) {
          openConflictDialog("create", availability);
          return;
        }
      } else {
        setAvailabilityResult(null);
        setAvailabilityError("");
      }

      await submitEventMutation("create", payload, { force });
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        const availability = await runAvailabilityCheck({
          startTime: payload.startTime,
          endTime: payload.endTime,
          attendeeIds: payload.attendeeIds ?? [],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
        if (availability && !availability.isAvailable) {
          openConflictDialog("create", availability);
          return;
        }
        try {
          await runAvailabilityCheck({
            startTime: payload.startTime,
            endTime: payload.endTime,
            attendeeIds: payload.attendeeIds ?? [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          });
        } catch {}
        await Promise.all([loadCalendar({ force: true }), loadSecondaryData()]);
        setActionError(
          "У части участников есть конфликт по времени. Проверьте доступность и попробуйте снова.",
        );
      } else {
        setActionError(getErrorMessage(error, "Не удалось создать событие."));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }
    if (!selectedEventId) {
      setActionError(
        "Не удалось определить событие для сохранения. Откройте его заново и повторите попытку.",
      );
      return;
    }
    setActionLoading(true);
    const payload = toEventPayload();
    if (!payload) {
      setActionLoading(false);
      return;
    }

    const conflictingEvent = findConflictingEvent(payload, {
      excludeEventId: selectedEventId,
    });
    if (conflictingEvent) {
      setActionError(
        `Это время уже занято: «${conflictingEvent.title}» (${conflictingEvent.timeLabel}).`,
      );
      setActionLoading(false);
      return;
    }

    setActionError("");
    try {
      const availability = await runAvailabilityCheck({
        startTime: payload.startTime,
        endTime: payload.endTime,
        attendeeIds: payload.attendeeIds ?? [],
        excludeEventId: selectedEventId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      if (!availability) {
        setActionError(
          "Не удалось проверить доступность участников. Попробуйте позже.",
        );
        return;
      }
      if (!availability.isAvailable) {
        openConflictDialog("update", availability);
        return;
      }

      await submitEventMutation("update", payload);
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        const availability = await runAvailabilityCheck({
          startTime: payload.startTime,
          endTime: payload.endTime,
          attendeeIds: payload.attendeeIds ?? [],
          excludeEventId: selectedEventId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
        if (availability && !availability.isAvailable) {
          openConflictDialog("update", availability);
          return;
        }
        await Promise.all([
          loadCalendar({ force: true }),
          loadSecondaryData(),
          selectEvent(selectedEventId),
        ]);
        setActionError(
          "Это время уже занято другим событием. Проверьте доступность и попробуйте снова.",
        );
      } else {
        setActionError(getErrorMessage(error, "Не удалось обновить событие."));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }
    if (!selectedEventId) {
      setActionError(
        "Не удалось определить событие для удаления. Откройте его заново и повторите попытку.",
      );
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await calendarController.deleteEvent(selectedEventId);
      setActionSuccess("Событие удалено.");
      setSelectedEventId("");
      setSelectedEvent(null);
      setEventPreview(null);
      setIsEventEditorOpen(false);
      await Promise.all([loadCalendar({ force: true }), loadSecondaryData()]);
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось удалить событие."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRsvp = async (status: CalendarRespondStatus) => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }
    if (!selectedEventId) {
      setActionError(
        "Не удалось определить событие для ответа на приглашение. Откройте его заново и повторите попытку.",
      );
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await calendarController.respondInvite(selectedEventId, status);
      setActionSuccess("Ответ на приглашение отправлен.");
      await Promise.all([
        loadCalendar({ force: true }),
        selectEvent(selectedEventId),
      ]);
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Не удалось отправить ответ на приглашение."),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetReminder = async (
    reminderValue = eventForm.reminderMinutes,
  ) => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }
    if (!selectedEventId) {
      setActionError(
        "Не удалось определить событие для напоминания. Откройте его заново и повторите попытку.",
      );
      return;
    }
    const minutesBefore = Number(reminderValue);
    if (!Number.isFinite(minutesBefore) || minutesBefore < 0) {
      setActionError("Введите корректное число минут для напоминания.");
      return;
    }

    setActionLoading(true);
    setActionError("");
    try {
      await calendarController.setReminder(selectedEventId, minutesBefore);
      setActionSuccess("Напоминание установлено.");
      await selectEvent(selectedEventId);
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Не удалось установить напоминание."),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReminder = async () => {
    if (isReadOnlyExternalCalendar) {
      setActionError(
        "Можно только просматривать календарь другого пользователя.",
      );
      return;
    }
    if (!selectedEventId) {
      setActionError(
        "Не удалось определить событие для удаления напоминания. Откройте его заново и повторите попытку.",
      );
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await calendarController.deleteReminder(selectedEventId);
      setActionSuccess("Напоминание удалено.");
      await selectEvent(selectedEventId);
    } catch (error) {
      setActionError(getErrorMessage(error, "Не удалось удалить напоминание."));
    } finally {
      setActionLoading(false);
    }
  };

  const performSearch = useCallback(
    (rawQuery: string) => {
      const query = rawQuery.trim().toLowerCase();
      if (!query) {
        setSearchResults([]);
        setSearchFocusEvent(null);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);

      const mapped = viewModel.events.filter(
        (event) =>
          (event.title || "").toLowerCase().includes(query) ||
          (event.description || "").toLowerCase().includes(query) ||
          (event.location || "").toLowerCase().includes(query),
      );

      setSearchResults(mapped);
      if (mapped.length === 0 && noResultsWarnedQueryRef.current !== rawQuery) {
        pushToast("warning", "Ничего не найдено");
        noResultsWarnedQueryRef.current = rawQuery;
        setSearchFocusEvent(null);
      }
      if (mapped.length > 0) {
        noResultsWarnedQueryRef.current = "";
        const first = mapped[0];
        if (selectedEventId !== first.id || selectedDayKey !== first.dayKey) {
          setSearchFocusEvent(first);
        }
      }
      setSearchLoading(false);
    },
    [viewModel.events, pushToast, selectedDayKey, selectedEventId],
  );

  useEffect(() => {
    const query = searchTitle.trim();
    if (!query) {
      setSearchResults([]);
      setSearchFocusEvent(null);
      setSearchLoading(false);
      noResultsWarnedQueryRef.current = "";
      return;
    }

    const timeout = window.setTimeout(() => {
      performSearch(query);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [performSearch, searchTitle, viewModel.events]);

  const reminderEditorValue = useMemo(
    () => getReminderEditorValue(eventForm.reminderMinutes),
    [eventForm.reminderMinutes],
  );
  const quickReminderOptions = useMemo(
    () => buildQuickReminderOptions(eventForm.reminderMinutes),
    [eventForm.reminderMinutes],
  );

  const hasFullError = !filteredEvents.length && eventsError;

  useEffect(() => {
    if (isLoading || hasFullError) {
      return;
    }
    if (mode !== "week" && mode !== "day") {
      return;
    }

    const scrollEl = weekTimeScrollContainerRef.current;
    if (!scrollEl) {
      return;
    }

    const apply = () => {
      const todayKey = toDayKey(new Date());
      const includesToday = visibleDayKeys.includes(todayKey);
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      let anchorMinutes: number;
      if (includesToday) {
        anchorMinutes = Math.max(7 * 60, nowMinutes - 60);
      } else {
        anchorMinutes = 9 * 60;
      }

      const targetTop = (anchorMinutes / 60) * HOUR_ROW_HEIGHT;
      const stickyHeader = scrollEl.querySelector(".sticky");
      const headerH =
        stickyHeader instanceof HTMLElement ? stickyHeader.offsetHeight : 72;
      const visibleBelowHeader = Math.max(120, scrollEl.clientHeight - headerH);
      let scrollTop = targetTop - headerH - visibleBelowHeader * 0.12;
      const maxScroll = Math.max(
        0,
        scrollEl.scrollHeight - scrollEl.clientHeight,
      );
      scrollTop = Math.max(0, Math.min(scrollTop, maxScroll));
      scrollEl.scrollTop = scrollTop;
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(apply);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [anchorDate, hasFullError, isLoading, mode, targetUserId, visibleDayKeys]);

  const rightSidebarContent = (
    <div className="space-y-3">
      <section className="rounded-xl border border-[#E5ECF7] bg-[#FAFCFF] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#263C5A]">Событие</h3>
          {selectedEventLoading ? (
            <span className="text-[11px] text-[#7B8EA9]">Загрузка...</span>
          ) : null}
        </div>
        {selectedEvent ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-[#E5ECF7] bg-white p-2">
              <p className="truncate text-sm font-semibold text-[#243D5C]">
                {selectedEvent.title}
              </p>
              <p className="mt-1 text-xs text-[#6F84A3]">
                {selectedEvent.timeLabel}
              </p>
              <p className="mt-1 text-xs text-[#6F84A3]">
                {selectedEvent.location ||
                  (selectedEvent.isOnline ? "Онлайн" : "Оффлайн")}
              </p>
              {selectedEvent.isOnline ? (
                <div className="mt-2 rounded-lg border border-[#D7E7FF] bg-[#F5F9FF] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#1E4F91]">
                        {getOnlineMeetingProviderLabel(selectedEvent)}
                      </p>
                      <p className="text-[11px] text-[#5F7CA8]">
                        {getOnlineMeetingStatusLabel(selectedEvent)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#E4F0FF] px-2 py-0.5 text-[10px] font-semibold text-[#1E88E5]">
                      Онлайн
                    </span>
                  </div>
                  {selectedEvent.joinUrl ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openMeetingLink(selectedEvent.joinUrl)}
                        className="h-8 flex-1 rounded-lg bg-[#1E88E5] px-2 text-[11px] font-semibold text-white hover:bg-[#1666CC]"
                      >
                        Войти
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openMeetingInNewTab(selectedEvent.joinUrl)
                        }
                        className="h-8 rounded-lg border border-[#CFE0F8] bg-white px-2 text-[11px] font-semibold text-[#2D4A6E] hover:bg-[#F4F8FF]"
                      >
                        Новая вкладка
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void copyMeetingLink(selectedEvent.joinUrl);
                        }}
                        className="h-8 rounded-lg border border-[#CFE0F8] bg-white px-2 text-[11px] font-semibold text-[#2D4A6E] hover:bg-[#F4F8FF]"
                      >
                        Копировать
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-[#5F7CA8]">
                      Ссылка на онлайн-встречу недоступна
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  openEditEventEditor();
                }}
                disabled={isReadOnlyExternalCalendar}
                className="h-8 rounded-lg border border-[#D5E2F4] bg-white text-xs font-semibold text-[#2D4A6E] hover:bg-[#F4F8FF]"
              >
                Редакт.
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteEvent();
                }}
                disabled={isReadOnlyExternalCalendar}
                className="h-8 rounded-lg border border-[#F0CFCF] bg-[#FFF6F6] text-xs font-semibold text-[#C53030] hover:bg-[#FFEDED]"
              >
                Удалить
              </button>
            </div>
            {!selectedEvent.isOrganizer ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleRsvp("accepted");
                  }}
                  className="h-8 rounded-lg border border-[#CFEBDD] bg-[#EAF9F1] text-[11px] font-semibold text-[#1B7A43]"
                >
                  Принять
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRsvp("declined");
                  }}
                  className="h-8 rounded-lg border border-[#F0CFCF] bg-[#FFF0F0] text-[11px] font-semibold text-[#B63B3B]"
                >
                  Отклонить
                </button>
              </div>
            ) : null}
            <div className="space-y-2">
              <AppSelect
                value={eventForm.reminderMinutes}
                options={quickReminderOptions}
                onChange={(value) => {
                  setEventForm((prev) => ({ ...prev, reminderMinutes: value }));
                  if (value) {
                    void handleSetReminder(value);
                    return;
                  }
                  void handleDeleteReminder();
                }}
                placeholder="Напоминание"
                ariaLabel="Выбор напоминания"
                buttonClassName="h-8 rounded-lg border border-[#D7E2F3] bg-white px-2 text-xs"
                menuClassName="z-[430]"
              />
              <p className="text-[11px] text-[#7E93B1]">
                Напоминание меняется сразу после выбора.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#7E93B1]">
            Выберите событие в сетке или в поиске.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[#E5ECF7] bg-[#FAFCFF] p-3">
        <h3 className="mb-2 text-sm font-semibold text-[#263C5A]">
          События на выбранный день
        </h3>
        <div className="space-y-2">
          {selectedDayEvents.length ? (
            selectedDayEvents.slice(0, 5).map((event) => (
              <article
                key={`side-${event.id}`}
                onClick={() => {
                  openEventPreview(event);
                }}
                className="cursor-pointer rounded-xl border border-[#E5ECF7] bg-white p-2.5 transition hover:border-[#C8DCF8] hover:bg-[#F4F9FF]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: event.color || "#1E88E5" }}
                  />
                  <p className="truncate text-sm font-semibold text-[#233B5A]">
                    {event.title}
                  </p>
                </div>
                <p className="text-xs text-[#6F84A3]">{event.timeLabel}</p>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[#D5E0F0] bg-[#F9FBFF] px-3 py-4 text-center text-xs text-[#7E93B1]">
              Событий нет
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#E5ECF7] bg-[#FAFCFF] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#263C5A]">
            Ближайшие события
          </h3>
          <button
            type="button"
            onClick={() => {
              void loadSecondaryData();
            }}
            className="text-[11px] font-semibold text-[#1E88E5]"
          >
            Обновить
          </button>
        </div>
        <div className="space-y-1.5">
          {upcomingEvents.slice(0, 4).map((event) => (
            <button
              key={`upcoming-${event.id}`}
              type="button"
              onClick={() => {
                openEventPreview(event);
              }}
              className="flex w-full items-center justify-between rounded-lg border border-[#E5ECF7] bg-white px-2 py-1.5 text-left hover:bg-[#F4F8FF]"
            >
              <span className="truncate text-xs text-[#284260]">
                {event.title}
              </span>
              <span className="ml-2 text-[11px] text-[#7A8EAE]">
                {event.timeLabel}
              </span>
            </button>
          ))}
          {!upcomingEvents.length ? (
            <p className="text-xs text-[#7E93B1]">Нет ближайших событий</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-[#E5ECF7] bg-[#FAFCFF] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#263C5A]">
            Сводка за сегодня
          </h3>
          {todayLoading ? (
            <span className="text-[11px] text-[#7B8EA9]">...</span>
          ) : null}
        </div>
        <p className="text-xs text-[#6E83A2]">
          События: {todaySummary?.eventsCount ?? 0} · Задачи:{" "}
          {todaySummary?.tasksCount ?? 0}
        </p>
        {todaySummary?.tasks.slice(0, 3).map((task) => (
          <div
            key={`task-${task.id}`}
            className="mt-1 rounded-lg border border-[#E5ECF7] bg-white px-2 py-1.5 text-xs text-[#2B4464]"
          >
            {task.title || "Без названия"}
          </div>
        ))}
      </section>
    </div>
  );

  const organizerUserId =
    eventEditorMode === "edit"
      ? (selectedEvent?.organizerUserId ?? null)
      : null;

  const guestSelectOptions = useMemo(() => {
    const sourceUsers =
      calendarGuestSearchResults.length || calendarGuestSearch.trim()
        ? calendarGuestSearchResults
        : calendarUsers;
    const baseOptions = sourceUsers.map((user) => ({
      value: String(user.id),
      label: user.fullName || user.email || `User ${user.id}`,
      disabled: organizerUserId !== null && user.id === organizerUserId,
    }));

    if (selectedEvent) {
      selectedEvent.attendees.forEach((attendee) => {
        if (
          !baseOptions.some((opt) => Number(opt.value) === Number(attendee.id))
        ) {
          baseOptions.push({
            value: String(attendee.id),
            label: attendee.fullName,
            disabled:
              organizerUserId !== null &&
              Number(attendee.id) === Number(organizerUserId),
          });
        }
      });
    }

    return baseOptions;
  }, [
    calendarGuestSearch,
    calendarGuestSearchResults,
    calendarUsers,
    organizerUserId,
    selectedEvent,
  ]);

  const selectedGuestUsers = useMemo(() => {
    return eventForm.attendeeIds.map((id) => {
      const fromBase = calendarUsers.find((u) => Number(u.id) === Number(id));
      if (fromBase) return fromBase;

      const fromEvent = selectedEvent?.attendees.find(
        (a) => Number(a.id) === Number(id),
      );
      if (fromEvent)
        return {
          id: fromEvent.id,
          fullName: fromEvent.fullName,
          email: fromEvent.email,
        };

      return { id: Number(id), fullName: `User ${id}`, email: "" };
    });
  }, [calendarUsers, eventForm.attendeeIds, selectedEvent, organizerUserId]);

  const selectedGuestUsersById = useMemo(() => {
    return new Map(selectedGuestUsers.map((user) => [Number(user.id), user]));
  }, [selectedGuestUsers]);

  const groupedAvailabilityConflicts = useMemo<
    CalendarConflictsByUser[]
  >(() => {
    if (!availabilityResult) return [];
    if (availabilityResult.conflictsByUser.length)
      return availabilityResult.conflictsByUser;

    const grouped = new Map<number, CalendarConflictsByUser>();
    availabilityResult.conflicts.forEach((conflict) => {
      const existing = grouped.get(conflict.userId);
      if (existing) {
        existing.conflicts.push(conflict);
        return;
      }
      grouped.set(conflict.userId, {
        userId: conflict.userId,
        userName: conflict.userName,
        username: conflict.username,
        email: conflict.email,
        avatarUrl: conflict.avatarUrl,
        conflicts: [conflict],
      });
    });
    return Array.from(grouped.values()).filter((group) =>
      organizerUserId === null ? true : Number(group.userId) !== Number(organizerUserId),
    );
  }, [availabilityResult, organizerUserId]);

  const availabilityConflictMeta = useMemo(() => {
    const nameCounts = new Map<string, number>();

    groupedAvailabilityConflicts.forEach((group) => {
      const fallbackUser = selectedGuestUsersById.get(group.userId);
      const displayName = (
        group.userName ||
        fallbackUser?.fullName ||
        `User ${group.userId}`
      ).trim();
      nameCounts.set(displayName, (nameCounts.get(displayName) ?? 0) + 1);
    });

    return groupedAvailabilityConflicts.map((group) => {
      const fallbackUser = selectedGuestUsersById.get(group.userId);
      const displayName = (
        group.userName ||
        fallbackUser?.fullName ||
        `User ${group.userId}`
      ).trim();
      const username = group.username || "";
      const email = group.email || fallbackUser?.email || "";
      const identityLine =
        (nameCounts.get(displayName) ?? 0) > 1
          ? [username ? `@${username}` : "", email].filter(Boolean).join(" / ")
          : "";
      const avatarUrl =
        group.avatarUrl ||
        group.conflicts.find((conflict) => conflict.avatarUrl)?.avatarUrl ||
        null;

      return {
        group,
        displayName,
        identityLine,
        avatarUrl,
      };
    });
  }, [groupedAvailabilityConflicts, selectedGuestUsersById]);

  const availabilityTimezone = useMemo(() => {
    const slotTimezone =
      availabilityResult?.suggestedSlots[0]?.timezone ||
      availabilityResult?.partialSuggestedSlots[0]?.timezone;
    return (
      slotTimezone ||
      buildAvailabilityPayload()?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC"
    );
  }, [availabilityResult, buildAvailabilityPayload]);

  const currentAvailabilityPayload = useMemo(
    () => buildAvailabilityPayload(),
    [buildAvailabilityPayload],
  );

  const conflictedUsersCount = useMemo(() => {
    return groupedAvailabilityConflicts.length;
  }, [groupedAvailabilityConflicts]);

  const sortedSuggestedSlots = useMemo(
    () => sortSuggestedSlots(availabilityResult?.suggestedSlots ?? []),
    [availabilityResult],
  );

  const visibleSuggestedSlots = useMemo(
    () =>
      showAllSuggestedSlots
        ? sortedSuggestedSlots
        : sortedSuggestedSlots.slice(0, MAX_VISIBLE_SUGGESTED_SLOTS),
    [showAllSuggestedSlots, sortedSuggestedSlots],
  );

  const hiddenSuggestedSlotsCount = Math.max(
    0,
    sortedSuggestedSlots.length - MAX_VISIBLE_SUGGESTED_SLOTS,
  );

  const selectedSuggestedSlot = useMemo(
    () =>
      sortedSuggestedSlots.find(
        (slot) => getSuggestedSlotKey(slot) === selectedSuggestedSlotKey,
      ) ?? null,
    [selectedSuggestedSlotKey, sortedSuggestedSlots],
  );

  const runAvailabilityCheck = useCallback(
    async (payload: EventAvailabilityPayload) => {
      setAvailabilityLoading(true);
      setAvailabilityError("");
      try {
        const availability =
          await calendarController.checkAvailability(payload);
        setAvailabilityResult(availability);
        return availability;
      } catch (error) {
        setAvailabilityResult(null);
        setAvailabilityError(
          getErrorMessage(
            error,
            "Не удалось проверить доступность участников. Попробуйте позже.",
          ),
        );
        return null;
      } finally {
        setAvailabilityLoading(false);
      }
    },
    [calendarController],
  );

  const openConflictDialog = useCallback(
    (
      mode: "create" | "update",
      availability: CalendarAvailabilityResponse,
    ) => {
      const sortedSlots = sortSuggestedSlots(availability.suggestedSlots ?? []);
      setConflictActionMode(mode);
      setAvailabilityResult(availability);
      setShowAllSuggestedSlots(false);
      setSelectedSuggestedSlotKey(
        sortedSlots.length ? getSuggestedSlotKey(sortedSlots[0]) : "",
      );
      setIsConflictDialogOpen(true);
    },
    [],
  );

  const submitEventMutation = useCallback(
    async (
      mode: "create" | "update",
      payload: CreateCalendarEventPayload | UpdateCalendarEventPayload,
      options?: { force?: boolean },
    ) => {
      if (mode === "create") {
        await calendarController.createEvent(payload, {
          force: options?.force,
        });
      } else {
        if (!selectedEventId) {
          throw new Error(
            "Не удалось определить событие для сохранения. Откройте его заново и повторите попытку.",
          );
        }
        await calendarController.updateEvent(selectedEventId, payload);
      }

      setAvailabilityResult(null);
      setAvailabilityError("");
      setIsConflictDialogOpen(false);
      setShowAllSuggestedSlots(false);
      setSelectedSuggestedSlotKey("");
      setActionSuccess(
        mode === "create" ? "Событие создано." : "Событие обновлено.",
      );
      setIsEventEditorOpen(false);

      await Promise.all([
        loadCalendar({ force: true }),
        loadSecondaryData(),
        ...(mode === "update" && selectedEventId
          ? [selectEvent(selectedEventId)]
          : []),
      ]);
    },
    [
      calendarController,
      loadCalendar,
      loadSecondaryData,
      selectEvent,
      selectedEventId,
    ],
  );

  const applySuggestedSlot = useCallback((slot: CalendarSuggestedSlot) => {
    if (!slot.startTime || !slot.endTime) return;
    setEventForm((prev) => ({
      ...prev,
      startAt: toLocalDateTimeInputValue(slot.startTime),
      endAt: toLocalDateTimeInputValue(slot.endTime),
    }));
  }, []);

  const applySuggestedSlotAndSubmit = useCallback(
    async (slot: CalendarSuggestedSlot) => {
      if (!slot.startTime || !slot.endTime) return;

      const payload = toEventPayload();
      if (!payload) return;

      const nextPayload = {
        ...payload,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };

      applySuggestedSlot(slot);
      setSelectedSuggestedSlotKey(getSuggestedSlotKey(slot));
      setActionLoading(true);
      try {
        const availability = await runAvailabilityCheck({
          startTime: slot.startTime,
          endTime: slot.endTime,
          attendeeIds: nextPayload.attendeeIds ?? [],
          excludeEventId:
            conflictActionMode === "update" ? selectedEventId || null : null,
          timezone:
            slot.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC",
        });
        if (!availability) {
          setActionError(
            "Не удалось проверить доступность участников. Попробуйте позже.",
          );
          return;
        }
        if (!availability.isAvailable) {
          openConflictDialog(conflictActionMode, availability);
          return;
        }

        await submitEventMutation(conflictActionMode, nextPayload);
      } catch (error) {
        setActionError(
          getErrorMessage(error, "Не удалось сохранить выбранное время."),
        );
      } finally {
        setActionLoading(false);
      }
    },
    [
      applySuggestedSlot,
      conflictActionMode,
      openConflictDialog,
      runAvailabilityCheck,
      selectedEventId,
      submitEventMutation,
      toEventPayload,
    ],
  );

  const handleSearchNextWeekSuggestions = useCallback(async () => {
    if (!currentAvailabilityPayload) return;
    const start = new Date(currentAvailabilityPayload.startTime);
    const end = new Date(currentAvailabilityPayload.endTime);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return;

    const durationMinutes = Math.max(
      1,
      Math.round((end.valueOf() - start.valueOf()) / 60000),
    );
    const nextWeekStart = new Date(start.valueOf() + 7 * 24 * 60 * 60 * 1000);
    const nextWeekEnd = new Date(
      nextWeekStart.valueOf() + 7 * 24 * 60 * 60 * 1000,
    );

    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const slots = await calendarController.suggestTimes({
        durationMinutes,
        attendeeIds: currentAvailabilityPayload.attendeeIds,
        preferredStart: nextWeekStart.toISOString(),
        preferredEnd: nextWeekEnd.toISOString(),
        timezone: currentAvailabilityPayload.timezone,
        limit: 5,
      });
      const sortedSlots = sortSuggestedSlots(slots);
      setAvailabilityResult((prev) =>
        prev ? { ...prev, suggestedSlots: sortedSlots } : prev,
      );
      setSelectedSuggestedSlotKey(
        sortedSlots.length ? getSuggestedSlotKey(sortedSlots[0]) : "",
      );
      setShowAllSuggestedSlots(false);
    } catch (error) {
      setAvailabilityError(
        getErrorMessage(
          error,
          "Не удалось подобрать время на следующую неделю. Можно продолжить создание события.",
        ),
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }, [calendarController, currentAvailabilityPayload]);

  const isEditingEvent = eventEditorMode === "edit" && Boolean(selectedEventId);
  const isEditingOrganizerEvent =
    isEditingEvent && Boolean(selectedEvent?.isOrganizer);
  const isEditingInviteEvent =
    isEditingEvent && selectedEvent?.isOrganizer === false;

  const showDesktopRightSidebar = false;
  const calendarTimeColumnWidth = isMobile ? (mode === "day" ? 52 : 44) : 60;
  const calendarGridTemplateColumns = `${calendarTimeColumnWidth}px repeat(${visibleDayKeys.length}, minmax(0, 1fr))`;
  visibleDayKeysRef.current = visibleDayKeys;
  calendarTimeColumnWidthRef.current = calendarTimeColumnWidth;

  return (
    <main className="min-h-0 flex-1 overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col">
        {isMobile ? (
          <header className="z-20 bg-white border-b border-[#EAF0F6] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#4D6486] hover:bg-[#F2F6FC] transition"
                aria-label="Открыть меню"
              >
                <MaterialSymbol name="menu" size={20} color="currentColor" />
              </button>
              <h1 className="text-lg font-bold text-[#1F2E45]">
                {targetUser ? targetUser.fullName : "Календарь"}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreateEventEditor}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1E88E5] text-white shadow-[0_4px_12px_rgba(30,136,229,0.2)] active:scale-[0.95] transition"
                aria-label="Создать событие"
              >
                <MaterialSymbol name="add" size={18} color="currentColor" />
              </button>

              <CalendarModeSwitch mode={mode} onChange={setMode} />
            </div>
          </header>
        ) : (
          <header className="z-20 bg-white px-3 py-2.5 md:px-5 border-b border-[#F0F4FA]">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#5C728E] hover:bg-[#F8FAFC] transition duration-200 lg:hidden"
                aria-label="Открыть боковую панель"
              >
                <MaterialSymbol name="menu" size={20} color="currentColor" />
              </button>

              <h1 className="mr-3 text-xl font-extrabold text-[#1F2E45] tracking-tight">
                {targetUser ? `Календарь: ${targetUser.fullName}` : "Календарь"}
              </h1>

              <button
                type="button"
                onClick={handleToday}
                className="inline-flex h-10 items-center rounded-full border border-[#E2E8F0] bg-white px-5 text-sm font-bold text-[#1F2E45] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-[#F8FAFC] transition duration-200"
              >
                Сегодня
              </button>

              <div className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C728E] hover:bg-[#F1F5F9] transition duration-200"
                  aria-label="Предыдущий период"
                >
                  <MaterialSymbol
                    name="chevron_left"
                    size={18}
                    color="currentColor"
                  />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C728E] hover:bg-[#F1F5F9] transition duration-200"
                  aria-label="Следующий период"
                >
                  <MaterialSymbol
                    name="chevron_right"
                    size={18}
                    color="currentColor"
                  />
                </button>
              </div>

              <p className="min-w-[170px] text-sm font-bold text-[#1F2E45] md:text-[17px] tracking-tight">
                {range.periodLabel}
              </p>

              <label className="relative w-full max-w-[320px]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#90A3BF]">
                  <MaterialSymbol
                    name="search"
                    size={18}
                    color="currentColor"
                  />
                </span>
                <input
                  value={searchTitle}
                  onChange={(event) => setSearchTitle(event.target.value)}
                  placeholder="Поиск событий..."
                  className="h-10 w-full rounded-full border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-9 text-sm text-[#1F2E45] outline-none transition focus:bg-white focus:border-[#1E88E5] focus:ring-4 focus:ring-[#EBF4FE]"
                />
                {searchLoading ? (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#90A3BF]">
                    <MaterialSymbol
                      name="progress_activity"
                      size={16}
                      color="currentColor"
                      style={{ animation: "spin 0.9s linear infinite" }}
                    />
                  </span>
                ) : null}
                {!searchLoading && searchTitle.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSearchTitle("")}
                    className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8CA0BE] transition hover:bg-[#EEF4FF] hover:text-[#4A6282]"
                    aria-label="Очистить поиск"
                  >
                    <MaterialSymbol
                      name="close"
                      size={14}
                      color="currentColor"
                    />
                  </button>
                ) : null}
              </label>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    openCreateEventEditor();
                  }}
                  disabled={isReadOnlyExternalCalendar}
                  className="hidden h-10 items-center gap-1.5 rounded-full bg-[#1E88E5] text-white px-4 text-xs font-bold shadow-[0_4px_12px_rgba(30,136,229,0.18)] hover:bg-[#1565C0] hover:shadow-[0_6px_16px_rgba(30,136,229,0.25)] transition duration-200 md:inline-flex"
                >
                  <MaterialSymbol name="add" size={16} color="currentColor" />
                  Создать
                </button>
                <CalendarModeSwitch mode={mode} onChange={setMode} />
              </div>
            </div>

            {hostError ? (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#F4C8C8] bg-[#FFF6F6] px-3 py-1.5 text-xs text-[#C53030]">
                <MaterialSymbol name="error" size={14} color="#C53030" />
                {hostError}
              </div>
            ) : null}
          </header>
        )}

        <div className="flex min-h-0 min-w-0 flex-1">
          <aside className="hidden w-[280px] shrink-0 border-r border-[#F0F2F5] bg-white lg:flex lg:flex-col">
            <div className="p-4">
              <button
                type="button"
                onClick={() => {
                  openCreateEventEditor();
                }}
                disabled={isReadOnlyExternalCalendar}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E88E5] text-white text-sm font-bold shadow-[0_6px_20px_rgba(30,136,229,0.25)] hover:shadow-[0_8px_24px_rgba(30,136,229,0.35)] hover:bg-[#1565C0] transition active:scale-[0.98] duration-200"
              >
                <MaterialSymbol name="add" size={18} color="currentColor" />
                Создать
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar transition-all duration-300">
              <div className="px-4 pb-4">
                <div className="rounded-2xl border border-[#EAF0F6] bg-white p-3.5 shadow-[0_4px_12px_rgba(28,45,70,0.02)]">
                  <div className="mb-3.5 flex items-center justify-between px-1">
                    <p className="text-sm font-bold tracking-tight text-[#1F2E45]">
                      {formatMonthTitle(anchorDate)}
                    </p>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#A0B1C6]">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                      <span key={day} className="uppercase tracking-wider">
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {miniCalendarCells.map((cell) => (
                      <button
                        key={`mini-${cell.dateKey}`}
                        type="button"
                        aria-label={`${cell.dateKey}${cell.events.length > 0 ? `, событий: ${cell.events.length}` : ""}`}
                        onClick={() => {
                          setSelectedDayKey(cell.dateKey);
                          setAnchorDate(parseDayKey(cell.dateKey));
                        }}
                        className={[
                          "flex flex-col items-center justify-center py-1 text-xs transition relative rounded-xl w-full",
                          cell.inCurrentMonth ? "" : "opacity-40",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-7 w-7 items-center justify-center text-[13px] font-bold rounded-full transition-all duration-200",
                            cell.isSelected
                              ? "bg-[#1E88E5] text-white shadow-[0_4px_12px_rgba(30,136,229,0.3)] scale-110"
                              : cell.isToday
                                ? "bg-[#EBF4FE] text-[#1E88E5] font-extrabold"
                                : "text-[#2D3F58] hover:bg-[#F2F6FC]",
                          ].join(" ")}
                        >
                          {cell.dayNumber}
                        </span>
                        <span className="mt-1 flex min-h-[4px] items-center justify-center gap-[3px]">
                          {getMiniCalendarEventDots(cell.events).map((dot) => (
                            <span
                              key={dot.key}
                              className="h-[4px] w-[4px] rounded-full"
                              style={{
                                backgroundColor: cell.isSelected
                                  ? "#A5B7D6"
                                  : dot.color,
                              }}
                              aria-hidden
                            />
                          ))}
                          {cell.events.length > MINI_CALENDAR_MAX_DOTS ? (
                            <span
                              className="h-[4px] w-[4px] rounded-full bg-[#9DB0C9]"
                              aria-hidden
                            />
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 px-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A9BB4]">
                  Пойск сотрудника
                </p>
              </div>
              <div className="px-4 pb-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Поиск сотрудника..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-lg border border-[#DDE5F2] bg-[#F8FAFD] py-1.5 pl-8 pr-3 text-sm focus:border-[#1E88E5] focus:outline-none focus:ring-1 focus:ring-[#1E88E5]"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                    <MaterialSymbol name="search" size={16} color="#8A9BB4" />
                  </div>
                </div>
              </div>

              <div className="px-1 pb-4">
                {targetUserId ? (
                  <div className="mx-2 mb-2 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 border border-blue-100">
                    <div className="flex-1 truncate">
                      <p className="text-xs font-bold text-blue-800">
                        Просмотр: {targetUser?.fullName}
                      </p>
                    </div>
                    <button
                      onClick={() => setTargetUserId(null)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <MaterialSymbol
                        name="close"
                        size={16}
                        color="currentColor"
                      />
                    </button>
                  </div>
                ) : null}

                {filteredUsers.length > 0 ? (
                  <div className="mx-2 space-y-1">
                    {filteredUsers.slice(0, 8).map((user) => (
                      <button
                        key={`search-user-${user.id}`}
                        onClick={() => {
                          setTargetUserId(user.id);
                          setUserSearch("");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#29405F] transition hover:bg-[#F4F7FD]"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                          {user.fullName.substring(0, 1)}
                        </div>
                        <span className="truncate">{user.fullName}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  userSearch.trim() && (
                    <p className="px-4 py-2 text-xs text-[#8A9BB4]">
                      Ничего не найдено
                    </p>
                  )
                )}
              </div>
            </div>
          </aside>

          {sidebarOpen ? (
            <div className="fixed inset-0 z-[260] lg:hidden">
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
              />
              <aside className="absolute inset-y-0 left-0 w-[292px] overflow-y-auto border-r border-[#DDE5F2] bg-white">
                <div className="flex items-center justify-between border-b border-[#E5ECF7] p-4">
                  <p className="text-sm font-semibold text-[#2A4263]">
                    Календари
                  </p>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D8E2F0] text-[#4D6486]"
                    aria-label="Закрыть панель"
                  >
                    <MaterialSymbol
                      name="close"
                      size={16}
                      color="currentColor"
                    />
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          <section className="min-h-0 min-w-0 flex-1 overflow-hidden p-3 md:p-4">
            {isLoading ? <CalendarSkeletons /> : null}

            {!isLoading && hasFullError ? (
              <div className="rounded-2xl border border-[#F4C8C8] bg-[#FFF6F6] p-5">
                <div className="mb-2 flex items-center gap-2 text-[#C53030]">
                  <MaterialSymbol name="error" size={18} color="#C53030" />
                  <span className="text-sm font-semibold">
                    Не удалось загрузить календарь.
                  </span>
                </div>
                <p className="mb-4 text-sm text-[#B44A4A]">{eventsError}</p>
                <button
                  type="button"
                  onClick={() => {
                    void loadCalendar({ force: true });
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E88E5] px-3 text-xs font-semibold text-white hover:bg-[#1565C0]"
                >
                  <MaterialSymbol name="refresh" size={14} color="#fff" />
                  Повторить
                </button>
              </div>
            ) : null}

            {!isLoading && !hasFullError ? (
              <div className="h-full min-h-0 min-w-0 overflow-hidden rounded-3xl border-0 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.07)]">
                {mode === "month" ? (
                  <div className="h-full min-h-0 overflow-hidden">
                    <CalendarMonthGrid
                      cells={monthCells}
                      onSelectDay={(dayKey) => {
                        setSelectedDayKey(dayKey);
                      }}
                      onOpenDay={(dayKey) => {
                        setSelectedDayKey(dayKey);
                        setAnchorDate(parseDayKey(dayKey));
                        setMode("day");
                      }}
                      onSelectEvent={openEventPreview}
                    />
                  </div>
                ) : null}

                {mode === "week" || mode === "day" ? (
                  isMobile ? (
                    <div className="flex h-full min-h-0 flex-col bg-[#F9FBFC] rounded-3xl overflow-hidden">
                      {/* Horizontal Week Strip */}
                      <div className="bg-white border-b border-[#EAF0F6] px-4 py-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                        <div className="flex items-center justify-between mb-3.5">
                          <span className="text-sm font-bold text-[#1F2E45]">
                            {formatMonthTitle(anchorDate)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handlePrev}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7A8FA6] hover:bg-[#F2F6FC] transition"
                            >
                              <MaterialSymbol
                                name="chevron_left"
                                size={16}
                                color="currentColor"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={handleToday}
                              className="text-xs font-semibold text-[#1E88E5] px-2 py-1 rounded-md hover:bg-[#EBF4FE] transition"
                            >
                              Сегодня
                            </button>
                            <button
                              type="button"
                              onClick={handleNext}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7A8FA6] hover:bg-[#F2F6FC] transition"
                            >
                              <MaterialSymbol
                                name="chevron_right"
                                size={16}
                                color="currentColor"
                              />
                            </button>
                          </div>
                        </div>

                        {/* Horizontal Week Picker */}
                        <div className="flex justify-between items-center gap-1">
                          {(() => {
                            const start = getStartOfWeek(anchorDate);
                            return Array.from({ length: 7 }).map((_, index) => {
                              const date = addDays(start, index);
                              const dayKey = toDayKey(date);
                              const isSelected =
                                dayKey === normalizedSelectedDayKey;
                              const isToday = dayKey === toDayKey(new Date());
                              const weekdayStr = new Intl.DateTimeFormat(
                                "ru-RU",
                                { weekday: "short" },
                              ).format(date);
                              const capitalizedWeekday =
                                weekdayStr.charAt(0).toUpperCase() +
                                weekdayStr.slice(1);

                              return (
                                <button
                                  key={`mob-week-${dayKey}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDayKey(dayKey);
                                    setAnchorDate(date);
                                  }}
                                  className="flex flex-col items-center flex-1 py-1 relative group"
                                >
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider mb-2 transition-colors ${isSelected ? "text-[#1E88E5]" : "text-[#A0B1C6]"}`}
                                  >
                                    {capitalizedWeekday}
                                  </span>
                                  <span
                                    className={`flex h-8 w-8 items-center justify-center text-sm font-bold rounded-full transition-all duration-300 ${
                                      isSelected
                                        ? "bg-[#1E88E5] text-white shadow-[0_6px_16px_rgba(30,136,229,0.3)] scale-110"
                                        : isToday
                                          ? "border border-[#1E88E5]/30 text-[#1E88E5] font-extrabold bg-[#EBF4FE]/40"
                                          : "text-[#2D3F58] hover:bg-[#F2F6FC]"
                                    }`}
                                  >
                                    {date.getDate()}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>

                        {/* Slide Indicator Line */}
                        <div className="flex justify-center mt-3">
                          <div className="w-9 h-1 rounded-full bg-[#E2EAF1]" />
                        </div>
                      </div>

                      {/* Scrollable Timeline Agenda */}
                      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar relative bg-[#FAFCFD]">
                        <div className="relative flex min-w-0 w-full py-4 pr-4 pl-1">
                          {/* Timeline Hours Column */}
                          <div className="w-[52px] shrink-0 relative">
                            {HOURS.map((hour) => (
                              <div
                                key={`mob-time-${hour}`}
                                className="relative border-r border-[#EBF0F6]/70"
                                style={{ height: "85px" }}
                              >
                                <span className="absolute right-3.5 -top-2 text-[10px] font-bold text-[#A5B5C9] bg-[#FAFCFD] px-1">
                                  {toHourLabel(hour)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Events Cards Area */}
                          <div className="flex-1 relative">
                            {/* Horizontal Dotted Lines matching hours */}
                            {HOURS.map((hour) => (
                              <div
                                key={`mob-grid-line-${hour}`}
                                className="absolute left-0 right-0 border-t border-[#EDF2F7] border-dashed pointer-events-none"
                                style={{ top: `${hour * 85}px`, height: "1px" }}
                              />
                            ))}

                            {/* Current Time Line Indicator */}
                            {(() => {
                              const isToday =
                                normalizedSelectedDayKey === toDayKey(now);
                              if (!isToday) return null;
                              const nowMinutes =
                                now.getHours() * 60 + now.getMinutes();
                              const lineTop = (nowMinutes / 60) * 85;

                              return (
                                <div
                                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                  style={{ top: `${lineTop}px` }}
                                >
                                  <span className="h-2.5 w-2.5 rounded-full bg-[#1E88E5] shadow-[0_0_8px_rgba(30,136,229,0.6)] -ml-[5px]" />
                                  <div className="flex-1 h-[2px] bg-[#1E88E5] opacity-75 shadow-[0_1px_3px_rgba(30,136,229,0.2)]" />
                                </div>
                              );
                            })()}

                            {/* Event Cards */}
                            {(() => {
                              const dayEvents = mobilePositionedEvents;
                              if (dayEvents.length === 0) {
                                return (
                                  <div className="flex flex-col items-center justify-center pt-24 text-center px-4">
                                    <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-[#90A3BF] shadow-[0_4px_12px_rgba(0,0,0,0.02)] mb-3">
                                      <MaterialSymbol
                                        name="event_busy"
                                        size={24}
                                        color="currentColor"
                                      />
                                    </div>
                                    <p className="text-sm font-semibold text-[#5C728E]">
                                      Нет событий на сегодня
                                    </p>
                                    <p className="text-xs text-[#90A3BF] mt-1">
                                      Отличный день для отдыха или новых планов!
                                    </p>
                                    <button
                                      type="button"
                                      onClick={openCreateEventEditor}
                                      className="mt-4 px-4 py-2 bg-[#1E88E5] text-white text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(30,136,229,0.2)] active:scale-[0.97] transition"
                                    >
                                      Создать событие
                                    </button>
                                  </div>
                                );
                              }

                              return dayEvents.map((item) => {
                                const widthPercent = 100 / item.lanes;
                                const leftPercent = item.lane * widthPercent;
                                const baseColor = item.event.color || "#1E88E5";
                                const isDeclined =
                                  item.event.myRsvpStatus === "declined";
                                const isPending =
                                  item.event.myRsvpStatus === "needs_action" &&
                                  !item.event.isOrganizer;

                                const scaledTop = (item.top / 60) * 85;
                                const scaledHeight = (item.height / 60) * 85;

                                return (
                                  <article
                                    key={`mob-event-${item.event.id}-${item.event.dayKey}-${item.event.startTime}`}
                                    onClick={(clickEvent) => {
                                      openEventPreview(
                                        item.event,
                                        clickEvent.clientX,
                                        clickEvent.clientY,
                                      );
                                    }}
                                    className={`absolute z-10 flex flex-col justify-between overflow-hidden rounded-[20px] bg-white p-3 border border-[#E9F0F8] shadow-[0_6px_16px_rgba(28,45,70,0.02)] hover:shadow-[0_10px_24px_rgba(28,45,70,0.06)] active:scale-[0.98] transition-all duration-200 cursor-pointer ${
                                      isDeclined
                                        ? "opacity-60 grayscale-[30%]"
                                        : ""
                                    }`}
                                    style={{
                                      top: `${scaledTop + 2}px`,
                                      height: `${scaledHeight - 4}px`,
                                      left: `calc(${leftPercent}% + 4px)`,
                                      width: `calc(${widthPercent}% - 8px)`,
                                      borderLeft: `4px solid ${isDeclined ? "#9CA3AF" : baseColor}`,
                                    }}
                                  >
                                    <div className="flex flex-col gap-1 min-h-0 overflow-hidden">
                                      <div className="flex items-start justify-between gap-1.5">
                                        <h4
                                          className={`text-xs font-bold leading-snug tracking-tight text-[#1F2E45] line-clamp-2 ${isDeclined ? "line-through text-gray-400" : ""}`}
                                        >
                                          {item.event.title}
                                        </h4>
                                        {isPending && (
                                          <span className="shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#3B82F6]/10 text-[#3B82F6]">
                                            <MaterialSymbol
                                              name="mail"
                                              size={9}
                                              color="currentColor"
                                            />
                                          </span>
                                        )}
                                      </div>
                                      {item.event.description && (
                                        <p className="text-[10px] text-[#7A8FA6] truncate leading-tight">
                                          {item.event.description}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-end justify-between mt-1">
                                      <span className="text-[9px] font-bold text-[#A0B1C6] tracking-wider uppercase">
                                        {toTimeRangeLabel(
                                          item.event.startTime,
                                          item.event.endTime,
                                          item.event.isAllDay,
                                        )}
                                      </span>

                                      <div className="h-5 w-5 rounded-full bg-[#F2F6FC] flex items-center justify-center text-[#7A8FA6] hover:bg-[#EBF4FE] hover:text-[#1E88E5] transition">
                                        <MaterialSymbol
                                          name="north_east"
                                          size={10}
                                          color="currentColor"
                                        />
                                      </div>
                                    </div>
                                  </article>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={weekTimeScrollContainerRef}
                      className="h-full min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar"
                    >
                      <div className="sticky top-0 z-10 border-b border-[#E5ECF7] bg-white/90 backdrop-blur-md">
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: calendarGridTemplateColumns,
                          }}
                        >
                          <div className="border-r border-[#E5ECF7]" />
                          {visibleDayKeys.map((dayKey) => {
                            const date = parseDayKey(dayKey);
                            const isToday = dayKey === toDayKey(new Date());
                            const selected =
                              dayKey === normalizedSelectedDayKey;
                            return (
                              <button
                                key={`head-${dayKey}`}
                                type="button"
                                onClick={() => setSelectedDayKey(dayKey)}
                                className={`min-w-0 border-r border-[#E5ECF7] px-1 py-3 text-center transition-all duration-200 md:px-2 ${selected ? "bg-[#1E88E5]/5" : "hover:bg-[#1E88E5]/3"}`}
                              >
                                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7B8EA9]">
                                  {new Intl.DateTimeFormat("ru-RU", {
                                    weekday: "short",
                                  }).format(date)}
                                </div>
                                <div
                                  className={`mx-auto mt-1 inline-flex h-8 min-w-[30px] items-center justify-center rounded-full px-1.5 text-sm font-semibold ${isToday ? "bg-[#1E88E5] text-white" : "text-[#263C5A]"}`}
                                >
                                  {date.getDate()}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div
                          className="grid min-h-[34px]"
                          style={{
                            gridTemplateColumns: calendarGridTemplateColumns,
                          }}
                        >
                          <div className="border-r border-[#E5ECF7] px-1 py-1 text-right text-[10px] font-semibold text-[#8EA0BA] md:px-2">
                            Весь день
                          </div>
                          {visibleDayKeys.map((dayKey) => {
                            const dayAllDayEvents =
                              allDayEventsByDay[dayKey] ?? [];
                            return (
                              <div
                                key={`all-day-${dayKey}`}
                                className="min-w-0 border-r border-[#E5ECF7] px-1 py-1"
                              >
                                <div className="flex min-h-6 flex-wrap gap-1">
                                  {dayAllDayEvents.slice(0, 3).map((event) => {
                                    const isAllDayDeclined =
                                      event.myRsvpStatus === "declined";
                                    const isAllDayPending =
                                      event.myRsvpStatus === "needs_action" &&
                                      !event.isOrganizer;
                                    const adBaseColor =
                                      event.color || "#1E88E5";
                                    return (
                                      <button
                                        key={`all-day-chip-${event.id}-${event.dayKey}`}
                                        type="button"
                                        onClick={(clickEvent) => {
                                          openEventPreview(
                                            event,
                                            clickEvent.clientX,
                                            clickEvent.clientY,
                                          );
                                        }}
                                        className={`inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-1.5 text-[11px] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:scale-[1.01] ${
                                          isAllDayDeclined
                                            ? "opacity-65 grayscale bg-gray-100 border-gray-300 text-gray-500 line-through"
                                            : ""
                                        } ${
                                          isAllDayPending ? "border-dashed" : ""
                                        }`}
                                        style={
                                          isAllDayDeclined
                                            ? {}
                                            : {
                                                backgroundColor: `${adBaseColor}12`,
                                                borderColor: `${adBaseColor}30`,
                                                color: adBaseColor,
                                              }
                                        }
                                        title={`${event.title} · ${event.timeLabel}`}
                                      >
                                        <span
                                          className="h-2 w-2 shrink-0 rounded-full"
                                          style={{
                                            backgroundColor: adBaseColor,
                                          }}
                                        />
                                        <span className="truncate">
                                          {event.title}
                                        </span>
                                      </button>
                                    );
                                  })}
                                  {dayAllDayEvents.length > 3 ? (
                                    <span className="inline-flex h-6 items-center rounded-md bg-[#F2F6FD] px-1.5 text-[11px] font-semibold text-[#5B7190]">
                                      +{dayAllDayEvents.length - 3}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        ref={calendarBodyGridRef}
                        className="grid"
                        style={{
                          gridTemplateColumns: calendarGridTemplateColumns,
                        }}
                      >
                        <div className="relative border-r border-[#E5ECF7] bg-white">
                          {HOURS.map((hour) => (
                            <div
                              key={`time-${hour}`}
                              className="relative border-b border-[#EEF2F8]"
                              style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                            >
                              <span
                                className={[
                                  "absolute right-1 text-[10px] text-[#8EA0BA] md:right-2 md:text-[11px]",
                                  hour === 0 ? "top-1" : "-top-2",
                                ].join(" ")}
                              >
                                {toHourLabel(hour)}
                              </span>
                              {/* 30 min dash marker */}
                              <div className="absolute top-1/2 right-0 w-1 border-t border-[#EEF2F8]" />
                            </div>
                          ))}
                        </div>

                        {visibleDayKeys.map((dayKey) => {
                          const isToday = dayKey === toDayKey(new Date());
                          const now = new Date();
                          const nowMinutes =
                            now.getHours() * 60 + now.getMinutes();
                          return (
                            <div
                              key={`column-${dayKey}`}
                              className="relative min-w-0 border-r border-[#E5ECF7] bg-white transition-colors duration-200 select-none"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(e) => void handleDrop(e, dayKey)}
                              onPointerDown={(e) =>
                                handleColumnPointerDown(e, dayKey)
                              }
                            >
                              {HOURS.map((hour) => (
                                <div
                                  key={`${dayKey}-hour-${hour}`}
                                  className="relative border-b border-[#EEF2F8] transition-colors hover:bg-[#F8FBFF]/50"
                                  style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                                >
                                  {/* Middle hour dash line */}
                                  <div className="absolute top-1/2 left-0 right-0 border-t border-[#F1F5F9] border-dashed" />
                                </div>
                              ))}

                              {dragSelection &&
                              dragSelection.dayKey === dayKey ? (
                                <div
                                  className="absolute left-[3px] right-[3px] z-[8] flex flex-col justify-between rounded-xl border border-[#1E88E5] bg-[#1E88E5]/10 px-2 py-1 text-[11px] font-semibold text-[#1E88E5] shadow-[0_4px_16px_rgba(30,136,229,0.12)] pointer-events-none transition-all"
                                  style={{
                                    top: `${dragSelection.startMinutes + 1}px`,
                                    height: `${dragSelection.endMinutes - dragSelection.startMinutes - 2}px`,
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">
                                      Новое событие
                                    </span>
                                    <span className="shrink-0 font-medium opacity-85 text-[10px]">
                                      {(() => {
                                        const formatMinutes = (
                                          minutes: number,
                                        ): string => {
                                          const h = Math.floor(minutes / 60);
                                          const m = minutes % 60;
                                          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                                        };
                                        return `${formatMinutes(dragSelection.startMinutes)} - ${formatMinutes(dragSelection.endMinutes)}`;
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              ) : null}

                              {isToday ? (
                                <div
                                  className="pointer-events-none absolute left-0 right-0 z-[5]"
                                  style={{
                                    top: `${(nowMinutes / 60) * HOUR_ROW_HEIGHT}px`,
                                  }}
                                >
                                  <div className="relative h-[2px] bg-[#1E88E5] shadow-[0_0_8px_rgba(30,136,229,0.3)]">
                                    <span className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-[#1E88E5] border-2 border-white shadow-[0_0_10px_rgba(30,136,229,0.5)]" />
                                  </div>
                                </div>
                              ) : null}

                              {(positionedByDay[dayKey] ?? []).map((item) => {
                                const widthPercent = 100 / item.lanes;
                                const leftPercent = item.lane * widthPercent;
                                const isEditing =
                                  activeEdit?.occurrenceKey ===
                                  toOccurrenceKey(item.event);

                                const isDeclined =
                                  item.event.myRsvpStatus === "declined";
                                const isPending =
                                  item.event.myRsvpStatus === "needs_action" &&
                                  !item.event.isOrganizer;

                                const baseColor = item.event.color || "#1E88E5";
                                const bgCol = "white";
                                const borderCol = isDeclined
                                  ? "#E2E8F0"
                                  : "#E9F0F8";

                                return (
                                  <article
                                    key={`${dayKey}__${item.event.id}__${item.event.startTime}`}
                                    draggable={false}
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      if (item.event.isOrganizer) {
                                        startPointerEdit(
                                          e,
                                          item.event,
                                          "move",
                                          dayKey,
                                        );
                                      }
                                    }}
                                    className={`group/event absolute z-[6] overflow-hidden rounded-[14px] border p-2 text-xs transition-all duration-200 shadow-[0_4px_12px_rgba(28,45,70,0.02)] hover:scale-[1.005] hover:shadow-[0_8px_24px_rgba(28,45,70,0.06)] ${
                                      item.event.isOrganizer
                                        ? "cursor-grab active:cursor-grabbing"
                                        : "cursor-pointer"
                                    } ${isEditing ? "ring-2 ring-[#1E88E5]/35" : ""} ${
                                      isDeclined
                                        ? "opacity-60 grayscale-[30%]"
                                        : ""
                                    } ${isPending ? "border-dashed" : ""}`}
                                    style={{
                                      top: `${item.top + 1}px`,
                                      height: `${item.height - 2}px`,
                                      left: `calc(${leftPercent}% + 3px)`,
                                      width: `calc(${widthPercent}% - 6px)`,
                                      backgroundColor: bgCol,
                                      borderColor: borderCol,
                                      borderLeft: `4px solid ${isDeclined ? "#9CA3AF" : baseColor}`,
                                      color: isDeclined ? "#6B7280" : "#1F2E45",
                                    }}
                                    onClick={(clickEvent) => {
                                      if (suppressNextPreviewRef.current) {
                                        suppressNextPreviewRef.current = false;
                                        return;
                                      }
                                      openEventPreview(
                                        item.event,
                                        clickEvent.clientX,
                                        clickEvent.clientY,
                                      );
                                    }}
                                    title={`${item.event.title} · ${item.event.timeLabel}`}
                                  >
                                    {item.event.isOrganizer &&
                                    !item.event.isAllDay ? (
                                      <>
                                        <button
                                          type="button"
                                          aria-label="Изменить время начала"
                                          onPointerDown={(e) =>
                                            startPointerEdit(
                                              e,
                                              item.event,
                                              "resize-start",
                                              dayKey,
                                            )
                                          }
                                          className="absolute left-0 right-0 top-0 h-3 cursor-ns-resize rounded-t-md bg-transparent flex items-center justify-center"
                                          style={{ pointerEvents: "auto" }}
                                        >
                                          <div className="w-8 h-[3px] rounded-full bg-slate-300 opacity-0 group-hover/event:opacity-100 transition-opacity mt-[2px]" />
                                        </button>
                                        <button
                                          type="button"
                                          aria-label="Изменить время окончания"
                                          onPointerDown={(e) =>
                                            startPointerEdit(
                                              e,
                                              item.event,
                                              "resize-end",
                                              dayKey,
                                            )
                                          }
                                          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize rounded-b-md bg-transparent flex items-center justify-center"
                                          style={{ pointerEvents: "auto" }}
                                        >
                                          <div className="w-8 h-[3px] rounded-full bg-slate-300 opacity-0 group-hover/event:opacity-100 transition-opacity mb-[2px]" />
                                        </button>
                                      </>
                                    ) : null}
                                    <div className="flex items-center justify-between gap-1">
                                      <p
                                        className={`truncate font-bold leading-tight ${isDeclined ? "line-through text-gray-400" : "text-[#1F2937]"}`}
                                      >
                                        {item.event.title}
                                      </p>
                                      {isPending && (
                                        <span
                                          className="shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#3B82F6]/10 text-[#3B82F6]"
                                          title="Ожидает ответа"
                                        >
                                          <MaterialSymbol
                                            name="mail"
                                            size={9}
                                            color="currentColor"
                                          />
                                        </span>
                                      )}
                                      {isDeclined && (
                                        <span
                                          className="shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-200 text-gray-500"
                                          title="Отклонено"
                                        >
                                          <MaterialSymbol
                                            name="close"
                                            size={9}
                                            color="currentColor"
                                          />
                                        </span>
                                      )}
                                    </div>
                                    <p
                                      className={`truncate text-[10px] mt-0.5 ${isDeclined ? "text-gray-400" : "text-[#64748B]"}`}
                                    >
                                      {item.event.timeLabel}
                                    </p>
                                  </article>
                                );
                              })}

                              {activeEdit &&
                              activeEdit.mode === "move" &&
                              activeEdit.draftDayKey === dayKey &&
                              activeEdit.originalDayKey !== dayKey ? (
                                <article
                                  key={`draft-${activeEdit.event.id}`}
                                  className="pointer-events-none absolute z-[8] overflow-hidden rounded-lg border border-[#90CAF9] bg-[#EBF4FE]/95 p-1.5 text-xs text-[#1F4F8A] shadow-[0_8px_20px_rgba(30,136,229,0.28)] ring-2 ring-[#1E88E5]/35"
                                  style={{
                                    top: `${(activeEdit.draftStartMinutes / 60) * HOUR_ROW_HEIGHT + 1}px`,
                                    height: `${((activeEdit.draftEndMinutes - activeEdit.draftStartMinutes) / 60) * HOUR_ROW_HEIGHT - 2}px`,
                                    left: "3px",
                                    width: "calc(100% - 6px)",
                                    borderLeft: `3px solid ${activeEdit.event.color || "#1E88E5"}`,
                                  }}
                                  title={`${activeEdit.event.title} · ${activeEdit.event.timeLabel}`}
                                >
                                  <p className="truncate font-semibold">
                                    {activeEdit.event.title}
                                  </p>
                                  <p className="truncate text-[11px] text-[#3F679A]">
                                    {toTimeRangeLabel(
                                      new Date(
                                        parseDayKey(
                                          activeEdit.draftDayKey,
                                        ).setHours(
                                          Math.floor(
                                            activeEdit.draftStartMinutes / 60,
                                          ),
                                          activeEdit.draftStartMinutes % 60,
                                          0,
                                          0,
                                        ),
                                      ).toISOString(),
                                      new Date(
                                        parseDayKey(
                                          activeEdit.draftDayKey,
                                        ).setHours(
                                          Math.floor(
                                            activeEdit.draftEndMinutes / 60,
                                          ),
                                          activeEdit.draftEndMinutes % 60,
                                          0,
                                          0,
                                        ),
                                      ).toISOString(),
                                      activeEdit.event.isAllDay,
                                    )}
                                  </p>
                                </article>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            ) : null}
          </section>

          {showDesktopRightSidebar ? (
            <aside className="hidden w-[340px] shrink-0 border-l border-[#DDE5F2] bg-white p-4 xl:block">
              {rightSidebarContent}
            </aside>
          ) : null}
        </div>
      </div>

      {rightSidebarOpen ? (
        <div
          className={`fixed inset-0 z-[300] ${showDesktopRightSidebar ? "xl:hidden" : ""}`}
        >
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setRightSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-[360px] overflow-y-auto border-l border-[#DDE5F2] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#2A4263]">
                Панель календаря
              </p>
              <button
                type="button"
                onClick={() => setRightSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D8E2F0] text-[#4D6486]"
                aria-label="Закрыть правую панель"
              >
                <MaterialSymbol name="close" size={16} color="currentColor" />
              </button>
            </div>
            {rightSidebarContent}
          </aside>
        </div>
      ) : null}

      {eventPreview
        ? (() => {
            const activePreviewEvent =
              selectedEvent && selectedEvent.id === eventPreview.event.id
                ? selectedEvent
                : eventPreview.event;
            return (
              <div className="fixed inset-0 z-[560] flex items-center justify-center p-4">
                <div
                  className={`absolute inset-0 ${isMobile ? "bg-black/15" : "bg-transparent"}`}
                  onClick={() => setEventPreview(null)}
                  aria-hidden="true"
                />
                <article
                  className={`z-[361] custom-scrollbar rounded-[32px] border-0 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] border border-[#EDF2F7] transition-all duration-300 ${
                    isMobile
                      ? "fixed bottom-4 left-4 right-4 max-h-[85vh] overflow-y-auto"
                      : "absolute !w-[440px] overflow-y-auto max-h-[calc(100vh-80px)]"
                  }`}
                  style={
                    isMobile
                      ? {}
                      : {
                          left: `clamp(220px, ${eventPreview.x}px, calc(100vw - 220px))`,
                          top: `clamp(40px, ${eventPreview.y - 180}px, calc(100vh - 540px))`,
                          transform: "translate(-50%, 0)",
                        }
                  }
                >
                  {/* Drag indicator pill for mobile */}
                  {isMobile && (
                    <div className="flex justify-center mb-4">
                      <div className="w-12 h-1 rounded-full bg-[#E2E8F0]" />
                    </div>
                  )}

                  <div className="mb-4 flex items-center justify-between border-b border-[#F0F4FA] pb-3">
                    {/* Visual Category Label */}
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shadow-sm"
                        style={{
                          backgroundColor:
                            activePreviewEvent.color || "#1E88E5",
                        }}
                      />
                      <span className="text-[10px] font-bold text-[#7A8FA6] uppercase tracking-wider">
                        Детали встречи
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          openEditEventEditor(activePreviewEvent);
                        }}
                        disabled={isReadOnlyExternalCalendar}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C728E] hover:bg-[#F1F5F9] transition disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Редактировать событие"
                      >
                        <MaterialSymbol
                          name="edit"
                          size={18}
                          color="currentColor"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteEvent();
                          setEventPreview(null);
                        }}
                        disabled={isReadOnlyExternalCalendar}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C728E] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Удалить событие"
                      >
                        <MaterialSymbol
                          name="delete"
                          size={18}
                          color="currentColor"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventPreview(null)}
                        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#1E293B] hover:bg-[#F1F5F9] transition"
                        aria-label="Закрыть карточку события"
                      >
                        <MaterialSymbol
                          name="close"
                          size={18}
                          color="currentColor"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-extrabold leading-snug tracking-tight text-[#1F2E45]">
                        {activePreviewEvent.title}
                      </h2>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#1E88E5] bg-[#EBF4FE]/50 px-2.5 py-1 rounded-lg">
                        <MaterialSymbol
                          name="schedule"
                          size={14}
                          color="currentColor"
                        />
                        {activePreviewEvent.timeLabel}
                      </p>

                      {/* Metadata Container Card */}
                      <div className="mt-4 bg-[#F8FAFC] rounded-2xl p-4 space-y-3.5 border border-[#EDF2F7]">
                        {activePreviewEvent.isOnline && (
                          <div className="flex items-start gap-3.5 text-[#5C728E]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#90A3BF] shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-[#EBF0F6]">
                              <MaterialSymbol
                                name="videocam"
                                size={16}
                                color="currentColor"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-bold text-[#4A5E73]">
                                  {getOnlineMeetingProviderLabel(
                                    activePreviewEvent,
                                  )}
                                </p>
                                <span className="rounded-full bg-[#EBF4FE] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1E88E5]">
                                  Онлайн
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#6B7F97]">
                                {getOnlineMeetingStatusLabel(
                                  activePreviewEvent,
                                )}
                              </p>
                              {activePreviewEvent.joinUrl ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMeetingLink(
                                        activePreviewEvent.joinUrl,
                                      )
                                    }
                                    className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1E88E5] px-3 text-xs font-semibold text-white transition hover:bg-[#1666CC]"
                                  >
                                    Присоединиться
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMeetingInNewTab(
                                        activePreviewEvent.joinUrl,
                                      )
                                    }
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[#D7E2F3] bg-white px-3 text-xs font-semibold text-[#314B6B] transition hover:bg-[#F8FBFF]"
                                  >
                                    Новая вкладка
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void copyMeetingLink(
                                        activePreviewEvent.joinUrl,
                                      );
                                    }}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-[#D7E2F3] bg-white px-3 text-xs font-semibold text-[#314B6B] transition hover:bg-[#F8FBFF]"
                                  >
                                    Копировать ссылку
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-[#6B7F97]">
                                  Ссылка на онлайн-встречу недоступна
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3.5 text-[#5C728E]">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#90A3BF] shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-[#EBF0F6]">
                            <MaterialSymbol
                              name="notifications"
                              size={16}
                              color="currentColor"
                            />
                          </div>
                          <p className="text-xs font-bold text-[#4A5E73]">
                            За {activePreviewEvent.reminderMinutes ?? 30} минут
                          </p>
                        </div>

                        {activePreviewEvent.recurrenceRule && (
                          <div className="flex items-center gap-3.5 text-[#5C728E]">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#90A3BF] shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-[#EBF0F6]">
                              <MaterialSymbol
                                name="sync"
                                size={16}
                                color="currentColor"
                              />
                            </div>
                            <p className="text-xs font-bold text-[#4A5E73]">
                              {RECURRENCE_OPTIONS.find(
                                (opt) =>
                                  opt.value ===
                                  activePreviewEvent.recurrenceRule,
                              )?.label || "Повторяется"}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-3.5 text-[#5C728E]">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#90A3BF] shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-[#EBF0F6]">
                            <MaterialSymbol
                              name="calendar_today"
                              size={16}
                              color="currentColor"
                            />
                          </div>
                          <div className="text-xs font-bold text-[#4A5E73]">
                            <p>
                              {activePreviewEvent.organizerName ||
                                viewModel.host?.fullName ||
                                "Организатор"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {activePreviewEvent.attendees &&
                      activePreviewEvent.attendees.length > 0 ? (
                        <div className="mt-5 border-t border-[#F0F4FA] pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#90A3BF]">
                              Участники ({activePreviewEvent.attendees.length})
                            </p>
                            {selectedEventLoading && (
                              <span className="text-[9px] text-[#90A3BF] animate-pulse">
                                Обновление...
                              </span>
                            )}
                          </div>
                          <div className="max-h-[160px] overflow-y-auto space-y-3.5 custom-scrollbar pr-1">
                            {activePreviewEvent.attendees.map((attendee) => {
                              const initials = attendee.fullName
                                ? attendee.fullName
                                    .substring(0, 1)
                                    .toUpperCase()
                                : "?";
                              const isOrganizer =
                                Number(attendee.id) ===
                                Number(activePreviewEvent.organizerUserId);

                              let statusIcon = "help";
                              let statusColor = "#5C728E";
                              let statusBg = "#F1F5F9";
                              let statusBorder = "border-[#E2E8F0]/60";
                              let statusLabel = "Ожидание";

                              if (attendee.status === "accepted") {
                                statusIcon = "check_circle";
                                statusColor = "#1B7A43";
                                statusBg = "#EAF9F1";
                                statusBorder = "border-[#CFEBDD]/60";
                                statusLabel = "Принял";
                              } else if (attendee.status === "declined") {
                                statusIcon = "cancel";
                                statusColor = "#B63B3B";
                                statusBg = "#FFF0F0";
                                statusBorder = "border-[#F0CFCF]/60";
                                statusLabel = "Отклонил";
                              }

                              return (
                                <div
                                  key={`preview-att-${attendee.id}`}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EBF4FE] text-[10px] font-extrabold text-[#1E88E5]">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#1F2E45] truncate leading-snug">
                                        {attendee.fullName}
                                        {isOrganizer && (
                                          <span className="ml-1.5 inline-flex items-center rounded-md bg-[#EEF2F6] px-1.5 py-0.5 text-[8px] font-extrabold text-[#5C728E] uppercase tracking-wider border border-[#E2E8F0]">
                                            Орг.
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div
                                    className={`flex h-6 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border ${statusBorder}`}
                                    style={{
                                      backgroundColor: statusBg,
                                      color: statusColor,
                                    }}
                                  >
                                    <MaterialSymbol
                                      name={statusIcon}
                                      size={10}
                                      color="currentColor"
                                    />
                                    <span>{statusLabel}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {!activePreviewEvent.isOrganizer &&
                      activePreviewEvent.myRsvpStatus !== "accepted" &&
                      activePreviewEvent.myRsvpStatus !== "declined" ? (
                        <div className="mt-5 border-t border-[#F0F4FA] pt-4">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#90A3BF] mb-3">
                            Ваше участие
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                void handleRsvp("accepted");
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl border border-[#CFEBDD] bg-[#EAF9F1] text-xs font-bold text-[#1B7A43] transition duration-200 shadow-[0_2px_6px_rgba(27,122,67,0.04)] hover:bg-[#DFF6EA] active:scale-[0.98]"
                            >
                              <MaterialSymbol
                                name="check_circle"
                                size={14}
                                color="currentColor"
                              />
                              Принять
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                void handleRsvp("declined");
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl border border-[#F0CFCF] bg-[#FFF0F0] text-xs font-bold text-[#B63B3B] transition duration-200 shadow-[0_2px_6px_rgba(182,59,59,0.04)] hover:bg-[#FEE2E2] active:scale-[0.98]"
                            >
                              <MaterialSymbol
                                name="cancel"
                                size={14}
                                color="currentColor"
                              />
                              Отклонить
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              </div>
            );
          })()
        : null}

      {isEventEditorOpen ? (
        <div
          className="fixed inset-0 z-[600] overflow-y-auto overscroll-contain bg-black/15 backdrop-blur-[2px]"
          onClick={handleCloseEventEditor}
        >
          <div className="flex min-h-[100dvh] w-full items-center justify-center p-2 sm:p-4 lg:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={
                eventEditorMode === "create"
                  ? "Создание события"
                  : "Редактирование события"
              }
              className="flex min-h-0 w-full max-w-[1320px] max-h-[min(920px,calc(100dvh-2rem))] flex-col overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_32px_96px_rgba(15,23,42,0.08)] sm:max-h-[min(920px,calc(100dvh-2.5rem))]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 flex-wrap items-center gap-4 bg-white px-4 py-4 sm:px-6 sm:py-5 border-b border-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={handleCloseEventEditor}
                    className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] transition-all hover:bg-[#F1F5F9] hover:text-[#1E88E5] active:scale-95"
                    aria-label="Закрыть редактор"
                  >
                    <MaterialSymbol
                      name="close"
                      size={22}
                      color="currentColor"
                    />
                  </button>

                  <div className="order-last relative w-full sm:order-none sm:min-w-0 sm:max-w-[640px] sm:flex-1">
                    <input
                      value={eventForm.title}
                      autoFocus
                      onChange={(event) => {
                        setEventForm((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }));
                        if (fieldErrors.title)
                          setFieldErrors((prev) => ({ ...prev, title: false }));
                      }}
                      placeholder="Название события"
                      readOnly={isEditingInviteEvent}
                      className={`peer h-12 w-full bg-transparent text-[24px] sm:text-[32px] font-bold tracking-tight outline-none transition-all placeholder:text-[#94A3B8] ${
                        fieldErrors.title
                          ? "text-[#E53935] placeholder:text-[#EF9A9A]"
                          : "text-[#1E293B]"
                      } ${isEditingInviteEvent ? "cursor-default" : ""}`}
                    />
                    <div
                      className={`absolute -bottom-1 left-0 h-[2px] transition-all duration-300 peer-focus:w-full ${
                        fieldErrors.title
                          ? "w-full bg-[#E53935]"
                          : "w-0 bg-[#1E88E5]"
                      }`}
                    />
                    <span
                      title="Обязательное поле"
                      className={`absolute -right-4 top-1 font-bold text-[#E53935] transition-opacity ${eventForm.title ? "opacity-0" : "opacity-100"}`}
                    >
                      *
                    </span>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] ml-1">
                          Начало
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={eventForm.startAt.slice(0, 10)}
                            disabled={isEditingInviteEvent}
                            onChange={(event) => {
                              setEventForm((prev) =>
                                shiftEventStartPreservingDuration(
                                  prev,
                                  `${event.target.value}T${prev.startAt.slice(11, 16) || "09:00"}`,
                                ),
                              );
                              if (fieldErrors.startAt)
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  startAt: false,
                                }));
                            }}
                            className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:bg-white focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/10 ${
                              fieldErrors.startAt
                                ? "border-[#E53935] bg-[#FFEBEE] ring-4 ring-[#E53935]/10"
                                : "border-[#E2E8F0] bg-[#F8FAFC]"
                            } ${isEditingInviteEvent ? "opacity-70" : ""}`}
                          />
                          <AppTimePicker
                            value={eventForm.startAt.slice(11, 16)}
                            disabled={isEditingInviteEvent}
                            onChange={(val) => {
                              setEventForm((prev) =>
                                shiftEventStartPreservingDuration(
                                  prev,
                                  `${prev.startAt.slice(0, 10) || toDayKey(new Date())}T${val}`,
                                ),
                              );
                              if (fieldErrors.startAt)
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  startAt: false,
                                }));
                            }}
                            error={fieldErrors.startAt}
                            buttonClassName={
                              fieldErrors.startAt
                                ? ""
                                : `!h-12 !rounded-2xl !border !border-[#E2E8F0] !bg-[#F8FAFC] hover:!bg-[#F1F5F9] focus:!border-[#1E88E5] focus:!ring-4 focus:!ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] ml-1">
                          Окончание
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            min={
                              eventForm.startAt.slice(0, 10) ||
                              new Date().toISOString().split("T")[0]
                            }
                            value={eventForm.endAt.slice(0, 10)}
                            disabled={isEditingInviteEvent}
                            onChange={(event) => {
                              setEventForm((prev) => ({
                                ...prev,
                                endAt: `${event.target.value}T${prev.endAt.slice(11, 16) || "10:00"}`,
                              }));
                              if (fieldErrors.endAt)
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  endAt: false,
                                }));
                            }}
                            className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none transition focus:bg-white focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/10 ${
                              fieldErrors.endAt
                                ? "border-[#E53935] bg-[#FFEBEE] ring-4 ring-[#E53935]/10"
                                : "border-[#E2E8F0] bg-[#F8FAFC]"
                            } ${isEditingInviteEvent ? "opacity-70" : ""}`}
                          />
                          <AppTimePicker
                            value={eventForm.endAt.slice(11, 16)}
                            disabled={isEditingInviteEvent}
                            onChange={(val) => {
                              setEventForm((prev) => ({
                                ...prev,
                                endAt: `${prev.endAt.slice(0, 10) || toDayKey(new Date())}T${val}`,
                              }));
                              if (fieldErrors.endAt)
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  endAt: false,
                                }));
                            }}
                            error={fieldErrors.endAt}
                            buttonClassName={
                              fieldErrors.endAt
                                ? ""
                                : `!h-12 !rounded-2xl !border !border-[#E2E8F0] !bg-[#F8FAFC] hover:!bg-[#F1F5F9] focus:!border-[#1E88E5] focus:!ring-4 focus:!ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <input
                        value={eventForm.location}
                        disabled={isEditingInviteEvent}
                        onChange={(event) =>
                          setEventForm((prev) => ({
                            ...prev,
                            location: event.target.value,
                          }))
                        }
                        placeholder="Укажите место проведения"
                        className={`h-12 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-sm text-[#1E293B] outline-none transition placeholder:text-[#94A3B8] focus:bg-white focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`}
                      />
                      <div className="space-y-2">
                        <AppSelect
                          value={reminderEditorValue}
                          options={REMINDER_PRESET_OPTIONS}
                          disabled={isEditingInviteEvent}
                          onChange={(value) => {
                            setEventForm((prev) => ({
                              ...prev,
                              reminderMinutes:
                                value === REMINDER_CUSTOM_VALUE
                                  ? getReminderEditorValue(
                                      prev.reminderMinutes,
                                    ) === REMINDER_CUSTOM_VALUE
                                    ? prev.reminderMinutes
                                    : ""
                                  : value,
                            }));
                          }}
                          placeholder="Уведомление"
                          ariaLabel="Выбор времени уведомления"
                          buttonClassName={`h-12 rounded-2xl !border !border-[#E2E8F0] !bg-[#F8FAFC] px-4 text-sm hover:!bg-[#F1F5F9] focus:!border-[#1E88E5] focus:!ring-4 focus:!ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`}
                          menuClassName="z-[460]"
                        />
                        {reminderEditorValue === REMINDER_CUSTOM_VALUE ? (
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={eventForm.reminderMinutes}
                            onChange={(event) =>
                              setEventForm((prev) => ({
                                ...prev,
                                reminderMinutes: event.target.value.replace(
                                  /[^\d]/g,
                                  "",
                                ),
                              }))
                            }
                            placeholder="Свое значение, мин"
                            className="h-12 w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-sm outline-none transition focus:bg-white focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/10"
                          />
                        ) : null}
                      </div>
                      <AppSelect
                        value={eventForm.recurrenceRule}
                        options={RECURRENCE_OPTIONS}
                        disabled={isEditingInviteEvent}
                        onChange={(value) => {
                          setEventForm((prev) => ({
                            ...prev,
                            recurrenceRule: value,
                          }));
                        }}
                        placeholder="Повторение"
                        ariaLabel="Выбор периодичности события"
                        buttonClassName={`h-12 rounded-2xl !border !border-[#E2E8F0] !bg-[#F8FAFC] px-4 text-sm hover:!bg-[#F1F5F9] focus:!border-[#1E88E5] focus:!ring-4 focus:!ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`}
                        menuClassName="z-[460]"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                        <AppSelect
                          value=""
                          options={guestSelectOptions}
                          onChange={() => {}}
                          searchable
                          onSearchChange={setCalendarGuestSearch}
                          multiple
                          selectedValues={eventForm.attendeeIds.map(String)}
                          onSelectedValuesChange={(values) => {
                            const nextAttendeeIds = values
                              .map((value) => Number(value))
                              .filter(
                                (value) => Number.isFinite(value) && value > 0,
                              );
                            setEventForm((prev) => ({
                              ...prev,
                              attendeeIds: nextAttendeeIds,
                            }));
                          }}
                          selectedSummaryText={(options) => {
                            if (options.length === 1) {
                              return `Выбран 1 гость`;
                            }
                            return `Выбрано гостей: ${options.length}`;
                          }}
                          searchPlaceholder="Поиск гостя..."
                          placeholder={
                            calendarUsersLoading
                              ? "Загрузка гостей..."
                              : "Выберите гостей"
                          }
                          ariaLabel="Выбор гостя"
                          className="w-full"
                          buttonClassName={`h-12 rounded-2xl !border !border-[#E2E8F0] !bg-white px-4 text-sm hover:!bg-[#F8FAFC] focus:!border-[#1E88E5] focus:!ring-4 focus:!ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`}
                          menuClassName="z-[460]"
                          disabled={
                            calendarUsersLoading || isEditingInviteEvent
                          }
                        />
                        <div className="mt-2.5 min-h-12 rounded-xl bg-white border border-[#E2E8F0]/80 p-2 flex flex-wrap items-center">
                          {selectedGuestUsers.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedGuestUsers.map((user) => (
                                <span
                                  key={user.id}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF4FE] border border-[#BBDEFB] pl-2.5 pr-1.5 py-1 text-xs font-semibold text-[#1E88E5] hover:bg-[#DBEAFE] transition-all"
                                >
                                  {user.fullName}
                                  {user.id !== organizerUserId ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEventForm((prev) => ({
                                          ...prev,
                                          attendeeIds: prev.attendeeIds.filter(
                                            (id) => id !== user.id,
                                          ),
                                        }));
                                      }}
                                      className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#1E88E5]/10 text-[#1E88E5] hover:bg-[#1E88E5]/20 transition-all font-bold text-[10px] ml-0.5"
                                      aria-label={`Убрать гостя ${user.fullName}`}
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#8AA0BF] px-1">
                              Гости не добавлены
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-6 text-sm text-[#475569] px-1 py-1">
                      <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#475569] cursor-pointer hover:text-[#1E88E5] transition-colors">
                        <input
                          type="checkbox"
                          checked={eventForm.isAllDay}
                          disabled={isEditingInviteEvent}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setEventForm((prev) =>
                              checked
                                ? normalizeFormForAllDay(prev)
                                : { ...prev, isAllDay: false },
                            );
                          }}
                          className="w-5 h-5 rounded-lg border-2 border-[#CBD5E1] text-[#1E88E5] focus:ring-[#1E88E5]/20 cursor-pointer transition-all"
                        />
                        Весь день
                      </label>
                      <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#475569] cursor-pointer hover:text-[#1E88E5] transition-colors">
                        <input
                          type="checkbox"
                          checked={eventForm.isOnline}
                          disabled={isEditingInviteEvent}
                          onChange={(event) =>
                            setEventForm((prev) => ({
                              ...prev,
                              isOnline: event.target.checked,
                            }))
                          }
                          className="w-5 h-5 rounded-lg border-2 border-[#CBD5E1] text-[#1E88E5] focus:ring-[#1E88E5]/20 cursor-pointer transition-all"
                        />
                        Онлайн
                      </label>
                    </div>

                    <textarea
                      rows={7}
                      value={eventForm.description}
                      disabled={isEditingInviteEvent}
                      onChange={(event) =>
                        setEventForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Добавьте описание"
                      className={`w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5 text-sm text-[#1E293B] placeholder:text-[#94A3B8] outline-none transition focus:bg-white focus:border-[#1E88E5] focus:ring-4 focus:ring-[#1E88E5]/10 ${isEditingInviteEvent ? "opacity-70" : ""}`}
                    />
                  </div>

                  <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                    <div className="rounded-3xl bg-white border border-[#E2E8F0] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1">
                        Гости
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {selectedGuestUsers.length
                          ? `Добавлено гостей: ${selectedGuestUsers.length}`
                          : "Добавьте гостей в поле слева."}
                      </p>
                      {selectedGuestUsers.length > 0 && (
                        <div className="mt-3 space-y-2.5 border-t border-[#F1F5F9] pt-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                          {selectedGuestUsers.map((user) => {
                            const initials = user.fullName
                              ? user.fullName.substring(0, 1).toUpperCase()
                              : "?";
                            const attendee = selectedEvent?.attendees.find(
                              (a) => Number(a.id) === Number(user.id),
                            );
                            const isOrganizer = selectedEvent
                              ? Number(user.id) ===
                                Number(selectedEvent.organizerUserId)
                              : organizerUserId
                                ? Number(user.id) === Number(organizerUserId)
                                : false;

                            let statusIcon = "help";
                            let statusColor = "#5F6368";
                            let statusBg = "#F1F3F4";
                            let statusText = "Ожидание";

                            if (attendee) {
                              if (attendee.status === "accepted") {
                                statusIcon = "check_circle";
                                statusColor = "#137333";
                                statusBg = "#E6F4EA";
                                statusText = "Принял";
                              } else if (attendee.status === "declined") {
                                statusIcon = "close";
                                statusColor = "#C5221F";
                                statusBg = "#FCE8E6";
                                statusText = "Отклонил";
                              }
                            }

                            return (
                              <div
                                key={`edit-sidebar-att-${user.id}`}
                                className="flex items-center justify-between gap-1.5 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EBF4FE] text-[11px] font-bold text-[#1E88E5]">
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[#1E293B] truncate leading-tight">
                                      {user.fullName}
                                      {isOrganizer && (
                                        <span className="ml-1.5 inline-flex items-center rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[8px] font-bold text-[#64748B] uppercase tracking-wider">
                                          Орг.
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                {selectedEvent && (
                                  <div
                                    className="flex h-5 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0 border"
                                    style={{
                                      backgroundColor: statusBg,
                                      color: statusColor,
                                      borderColor: `${statusColor}20`,
                                    }}
                                    title={statusText}
                                  >
                                    <MaterialSymbol
                                      name={statusIcon}
                                      size={10}
                                      color="currentColor"
                                    />
                                    <span>{statusText}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {isEditingOrganizerEvent ? (
                      <div className="rounded-3xl bg-white border border-[#E2E8F0] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                          Управление событием
                        </p>
                        <p className="mt-1 text-xs text-[#94A3B8]">
                          Вы организатор. Здесь доступно удаление события.
                        </p>
                        <div className="mt-3 space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedEventId) void handleDeleteEvent();
                            }}
                            className="h-11 w-full rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6]/60 text-xs font-bold text-[#C5221F] hover:bg-[#FCE8E6] transition-all active:scale-[0.98]"
                          >
                            Удалить событие
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {isEditingInviteEvent && (
                      <div className="rounded-3xl bg-white border border-[#E2E8F0] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                          Ответ на приглашение
                        </p>
                        {selectedEvent?.myRsvpStatus === "accepted" ? (
                          <p className="mt-1 text-xs font-semibold text-[#137333]">
                            Вы приняли приглашение на эту встречу.
                          </p>
                        ) : selectedEvent?.myRsvpStatus === "declined" ? (
                          <p className="mt-1 text-xs font-semibold text-[#C5221F]">
                            Вы отклонили это приглашение.
                          </p>
                        ) : (
                          <>
                            <p className="mt-1 text-xs text-[#94A3B8]">
                              Подтвердите участие или откажитесь.
                            </p>
                            <div className="mt-3 space-y-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedEventId)
                                    void handleRsvp("accepted");
                                }}
                                className="h-11 w-full rounded-2xl border border-[#C2E7CD] bg-[#E6F4EA] text-xs font-bold text-[#137333] hover:bg-[#D0EBD6] transition-all active:scale-[0.98]"
                              >
                                Принять
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedEventId)
                                    void handleRsvp("declined");
                                }}
                                className="h-11 w-full rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] text-xs font-bold text-[#C5221F] hover:bg-[#F9C3BE] transition-all active:scale-[0.98]"
                              >
                                Отклонить
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {!isEditingEvent ? (
                      <div className="rounded-3xl bg-white border border-[#E2E8F0] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                          Новое событие
                        </p>
                        <p className="mt-1 text-xs text-[#94A3B8] leading-relaxed">
                          Заполните форму слева и сохраните событие, когда всё
                          будет готово.
                        </p>
                      </div>
                    ) : null}
                  </aside>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#EAF0F6] bg-white px-4 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={handleCloseEventEditor}
                    className="h-12 rounded-2xl border border-[#E2E8F0] bg-white px-6 text-sm font-bold text-[#64748B] transition-all hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#1E293B] active:scale-[0.97]"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={
                      actionLoading ||
                      isReadOnlyExternalCalendar ||
                      (eventEditorMode === "edit" && !isEditingOrganizerEvent)
                    }
                    onClick={() => {
                      if (eventEditorMode === "create") {
                        void handleCreateEvent();
                      } else {
                        void handleUpdateEvent();
                      }
                    }}
                    className="h-12 min-w-[140px] rounded-2xl bg-[#1E88E5] px-8 text-sm font-bold text-white shadow-[0_4px_16px_rgba(30,136,229,0.2)] transition-all hover:bg-[#1565C0] hover:shadow-[0_6px_24px_rgba(30,136,229,0.3)] active:scale-[0.97] disabled:opacity-50"
                  >
                    {actionLoading ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isEventEditorOpen && isConflictDialogOpen && availabilityResult ? (
        <div
          className="fixed inset-0 z-[650] bg-black/35 backdrop-blur-[1px]"
          onClick={closeConflictDialog}
        >
          <div className="flex min-h-[100dvh] items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Есть конфликты в расписании"
              className="flex max-h-[min(860px,calc(100dvh-2rem))] w-full max-w-[820px] flex-col overflow-hidden rounded-[28px] border border-[#E8EEF5] bg-white shadow-[0_32px_96px_rgba(15,23,42,0.18)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#EEF3F8] px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[24px] font-extrabold tracking-tight text-[#1F2E45]">
                    Есть конфликты в расписании
                  </p>
                  <p className="mt-2 text-sm text-[#5C728E]">
                    В выбранное время некоторые участники уже заняты. Можно
                    выбрать другое удобное время.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeConflictDialog}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#1E88E5]"
                  aria-label="Закрыть окно конфликтов"
                >
                  <MaterialSymbol name="close" size={20} color="currentColor" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#E5EDF7] bg-[#F8FBFF] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7287A3]">
                      Вы выбрали
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#20344D]">
                      {currentAvailabilityPayload
                        ? formatSuggestedSlotLabel(
                            currentAvailabilityPayload.startTime,
                            currentAvailabilityPayload.endTime,
                            availabilityTimezone,
                          )
                        : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#F4D8D8] bg-[#FFF8F8] p-4">
                    <p className="text-sm font-semibold text-[#9F2D2D]">
                      Заняты {formatParticipantCountLabel(conflictedUsersCount)}
                    </p>
                    <p className="mt-1 text-xs text-[#7A4B4B]">
                      Ниже показаны только участники, у которых есть
                      пересечение по времени.
                    </p>
                  </div>

                  {availabilityLoading ? (
                    <div className="rounded-2xl border border-[#D8E3F2] bg-[#F8FBFF] p-4 text-sm text-[#31507A]">
                      Проверяем доступность...
                    </div>
                  ) : null}

                  {availabilityError ? (
                    <div className="rounded-2xl border border-[#F2D5D5] bg-[#FFF7F7] p-4 text-sm text-[#9F2D2D]">
                      {availabilityError}
                    </div>
                  ) : null}

                  <section className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-[#5B2C2C]">
                        Кто занят
                      </p>
                    </div>
                    <div className="space-y-3">
                      {availabilityConflictMeta.map(
                        ({ group, displayName, identityLine, avatarUrl }) => (
                          <div
                            key={group.userId}
                            className="rounded-2xl border border-[#F3E6E6] bg-[#FFFCFC] p-4"
                          >
                            <div className="flex items-start gap-3">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={displayName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDECEC] text-xs font-bold text-[#A33A3A]">
                                  {getInitials(displayName)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[#612E2E]">
                                  {displayName}
                                </p>
                                {identityLine ? (
                                  <p className="mt-1 text-xs text-[#7A4B4B]">
                                    {identityLine}
                                  </p>
                                ) : null}
                                <div className="mt-3 space-y-2">
                                  {group.conflicts.map((conflict) => {
                                    const overlapMinutes =
                                      currentAvailabilityPayload
                                        ? getOverlapMinutes(
                                            currentAvailabilityPayload.startTime,
                                            currentAvailabilityPayload.endTime,
                                            conflict.startTime,
                                            conflict.endTime,
                                            conflict.overlapMinutes,
                                          )
                                        : conflict.overlapMinutes ?? 0

                                    return (
                                      <div
                                        key={`${group.userId}-${conflict.eventId}-${conflict.startTime}`}
                                        className="rounded-xl border border-[#F8EAEA] bg-white px-3 py-3 text-xs text-[#7A4B4B]"
                                      >
                                        <p className="font-semibold text-[#6B2C2C]">
                                          Занят: «
                                          {conflict.eventTitle ||
                                            "Другое событие"}
                                          »
                                        </p>
                                        <p className="mt-1">
                                          {formatConflictDateTimeRange(
                                            conflict.startTime,
                                            conflict.endTime,
                                            availabilityTimezone,
                                          )}
                                        </p>
                                        <p className="mt-1">
                                          Пересечение: {overlapMinutes} мин
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </section>

                  {sortedSuggestedSlots.length ? (
                    <section className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-[#23466C]">
                          Подходящее время для всех
                        </p>
                        <p className="mt-1 text-xs text-[#58708F]">
                          Показываем лучшие варианты без технических оценок
                        </p>
                      </div>
                      <div className="space-y-3">
                        {visibleSuggestedSlots.map((slot) => {
                          const actualIndex = sortedSuggestedSlots.findIndex(
                            (item) =>
                              getSuggestedSlotKey(item) ===
                              getSuggestedSlotKey(slot),
                          )
                          const badgeLabel = getSuggestedSlotBadgeLabel(
                            slot,
                            actualIndex,
                            slot.timezone || availabilityTimezone,
                          )
                          const isSelected =
                            selectedSuggestedSlotKey ===
                            getSuggestedSlotKey(slot)

                          return (
                            <div
                              key={getSuggestedSlotKey(slot)}
                              className={`rounded-2xl border p-4 transition ${
                                isSelected
                                  ? "border-[#1E88E5] bg-[#F4F9FF] shadow-[0_8px_24px_rgba(30,136,229,0.12)]"
                                  : "border-[#DCE8F7] bg-white"
                              }`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedSuggestedSlotKey(
                                      getSuggestedSlotKey(slot),
                                    )
                                  }
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <span className="inline-flex rounded-full bg-[#EAF3FF] px-3 py-1 text-xs font-bold text-[#1E5FAF]">
                                    {badgeLabel}
                                  </span>
                                  <p className="mt-3 text-sm font-semibold text-[#16324F]">
                                    {formatSuggestedSlotLabel(
                                      slot.startTime,
                                      slot.endTime,
                                      slot.timezone || availabilityTimezone,
                                    )}
                                  </p>
                                  <p className="mt-1 text-xs text-[#58708F]">
                                    Свободны все участники
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => {
                                    void applySuggestedSlotAndSubmit(slot)
                                  }}
                                  className="h-11 rounded-xl bg-[#0E3CF6] px-4 text-sm font-semibold text-white transition hover:bg-[#0C35DB] disabled:opacity-50"
                                >
                                  Выбрать это время
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {hiddenSuggestedSlotsCount > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setShowAllSuggestedSlots((prev) => !prev)
                          }
                          className="inline-flex h-10 items-center rounded-xl border border-[#D6E4F5] bg-white px-4 text-sm font-semibold text-[#28527A] transition hover:bg-[#F8FBFF]"
                        >
                          {showAllSuggestedSlots
                            ? "Скрыть"
                            : `Показать ещё (${hiddenSuggestedSlotsCount})`}
                        </button>
                      ) : null}
                    </section>
                  ) : (
                    <section className="space-y-3 rounded-2xl border border-[#F5E8C8] bg-[#FFF9ED] p-4">
                      <div>
                        <p className="text-sm font-semibold text-[#8A6B22]">
                          Не нашли свободное время для всех в ближайшие дни.
                        </p>
                        <p className="mt-1 text-xs text-[#9F7A2B]">
                          Попробуйте другой день, меньшую длительность или
                          продолжите создание события.
                        </p>
                      </div>

                      {availabilityResult.partialSuggestedSlots.length ? (
                        <div className="space-y-2">
                          {sortSuggestedSlots(
                            availabilityResult.partialSuggestedSlots,
                          ).map((slot) => (
                            <div
                              key={getSuggestedSlotKey(slot)}
                              className="rounded-xl border border-[#F2E0AE] bg-white px-3 py-3"
                            >
                              <span className="inline-flex rounded-full bg-[#FFF2CC] px-3 py-1 text-xs font-bold text-[#8A6B22]">
                                {getSuggestedSlotBadgeLabel(
                                  slot,
                                  Number.MAX_SAFE_INTEGER,
                                  slot.timezone || availabilityTimezone,
                                )}
                              </span>
                              <p className="mt-3 text-sm font-semibold text-[#6E5517]">
                                {formatSuggestedSlotLabel(
                                  slot.startTime,
                                  slot.endTime,
                                  slot.timezone || availabilityTimezone,
                                )}
                              </p>
                              <p className="mt-1 text-xs text-[#8A6B22]">
                                {slot.label || "Часть участников свободна"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleSearchNextWeekSuggestions}
                          className="h-10 rounded-xl border border-[#E7C97A] bg-white px-4 text-sm font-semibold text-[#8A6B22] transition hover:bg-[#FFF6DA]"
                        >
                          Проверить следующую неделю
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEventForm((prev) => {
                              const nextStartIso =
                                fromLocalDateTimeInputValue(prev.startAt)
                              const nextEndIso =
                                fromLocalDateTimeInputValue(prev.endAt)
                              if (!nextStartIso || !nextEndIso) return prev
                              const shiftedStart = new Date(
                                new Date(nextStartIso).valueOf() +
                                  24 * 60 * 60 * 1000,
                              )
                              const shiftedEnd = new Date(
                                new Date(nextEndIso).valueOf() +
                                  24 * 60 * 60 * 1000,
                              )
                              return {
                                ...prev,
                                startAt: toLocalDateTimeInputValue(
                                  shiftedStart.toISOString(),
                                ),
                                endAt: toLocalDateTimeInputValue(
                                  shiftedEnd.toISOString(),
                                ),
                              }
                            })
                          }}
                          className="h-10 rounded-xl border border-[#E7C97A] bg-white px-4 text-sm font-semibold text-[#8A6B22] transition hover:bg-[#FFF6DA]"
                        >
                          Выбрать другой день
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEventForm((prev) => ({
                              ...prev,
                              endAt: (() => {
                                const startIso = fromLocalDateTimeInputValue(
                                  prev.startAt,
                                )
                                const endIso = fromLocalDateTimeInputValue(
                                  prev.endAt,
                                )
                                if (!startIso || !endIso) return prev.endAt
                                const start = new Date(startIso)
                                const end = new Date(endIso)
                                const currentMinutes = Math.max(
                                  15,
                                  Math.round(
                                    (end.valueOf() - start.valueOf()) / 60000,
                                  ),
                                )
                                const nextMinutes = Math.max(
                                  15,
                                  currentMinutes - 30,
                                )
                                return toLocalDateTimeInputValue(
                                  new Date(
                                    start.valueOf() + nextMinutes * 60000,
                                  ).toISOString(),
                                )
                              })(),
                            }))
                          }}
                          className="h-10 rounded-xl border border-[#E7C97A] bg-white px-4 text-sm font-semibold text-[#8A6B22] transition hover:bg-[#FFF6DA]"
                        >
                          Уменьшить длительность
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#EEF3F8] bg-white px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={closeConflictDialog}
                  className="h-11 rounded-2xl border border-[#E2E8F0] bg-white px-5 text-sm font-bold text-[#64748B] transition hover:bg-[#F8FAFC]"
                >
                  Вернуться к редактированию
                </button>
                {conflictActionMode === "create" ? (
                  <button
                    type="button"
                    disabled={actionLoading || isReadOnlyExternalCalendar}
                    onClick={() => {
                      void handleCreateEvent(true)
                    }}
                    className="h-11 rounded-2xl border border-[#FAD2E1] bg-[#FFF0F5] px-5 text-sm font-bold text-[#C52275] transition hover:bg-[#FCDAE6] disabled:opacity-50"
                  >
                    Создать всё равно
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!selectedSuggestedSlot || actionLoading}
                  onClick={() => {
                    if (!selectedSuggestedSlot) return
                    void applySuggestedSlotAndSubmit(selectedSuggestedSlot)
                  }}
                  className="h-11 rounded-2xl bg-[#1E88E5] px-5 text-sm font-bold text-white transition hover:bg-[#1565C0] disabled:opacity-50"
                >
                  Выбрать это время
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toastQueue.length > 0 ? (
        <div className="fixed right-4 top-16 z-[9999] flex w-[min(460px,calc(100vw-2rem))] flex-col gap-2">
          {toastQueue.map((toast) => (
            <AppToast
              key={toast.id}
              floating={false}
              variant={toast.variant}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
