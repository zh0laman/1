/* eslint-disable */
// @ts-nocheck

export const C = {
  // Sidebar — deep navy, almost black-blue
  sb: "#08111E",
  sbBorder: "rgba(255,255,255,0.06)",
  sbText: "rgba(255,255,255,0.38)",
  sbTextHover: "rgba(255,255,255,0.72)",
  sbHover: "rgba(255,255,255,0.04)",
  sbActive: "rgba(30,136,229,0.14)",
  sbActiveText: "#ffffff",
  sbSection: "rgba(255,255,255,0.18)",

  // Brand
  blue: "#1E88E5",
  blueDark: "#0D47A1",
  blueDeep: "#061A40",
  blueSoft: "#EBF4FE",
  blueGlow: "rgba(30,136,229,0.18)",

  // Surfaces
  bg: "#EDF0F7",
  canvas: "#F2F5FA",
  surface: "#FFFFFF",
  surfaceElevated: "#FAFBFD",
  glass: "rgba(255,255,255,0.72)",

  // Borders
  border: "#DDE3EE",
  borderLight: "#EAEFF8",

  // Text
  ink: "#0A1628",
  inkSub: "#374C6B",
  inkMuted: "#8497B4",
  inkFaint: "#B8C7DC",

  // Status
  green: "#0A8F5C",
  greenBg: "#E8FAF3",
  amber: "#C47C0A",
  amberBg: "#FEF7E8",
  red: "#C53030",
  redBg: "#FEF0F0",
  purple: "#6235C0",
  purpleBg: "#F2EEFF",
};

/* ═══════════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════════ */
export const STATS = [
  {
    id: "tasks", label: "Задачи в работе", value: 5, unit: "",
    delta: +12, deltaLabel: "vs прошлая неделя",
    icon: "task_alt", color: C.blue, bg: C.blueSoft,
    sparkline: [2, 3, 2, 4, 3, 5, 5],
  },
  {
    id: "meetings", label: "Встреч сегодня", value: 3, unit: "",
    delta: -1, deltaLabel: "vs вчера",
    icon: "videocam", color: C.purple, bg: C.purpleBg,
    sparkline: [4, 3, 5, 3, 4, 4, 3],
  },
  {
    id: "docs", label: "Документов", value: 14, unit: "",
    delta: +20, deltaLabel: "новых за неделю",
    icon: "folder_open", color: C.green, bg: C.greenBg,
    sparkline: [8, 9, 10, 11, 12, 13, 14],
  },
  {
    id: "score", label: "Баллы за неделю", value: 57, unit: "pts",
    delta: +8, deltaLabel: "+4 сегодня",
    icon: "military_tech", color: C.amber, bg: C.amberBg,
    sparkline: [30, 38, 42, 46, 51, 54, 57],
  },
];

export const TASKS = [
  { id: 1, title: "Квартальный отчёт министерства", priority: "Высокий", due: "28 мар", status: "В работе", assignee: "АС", prog: 72 },
  { id: 2, title: "Согласование бюджета Q2", priority: "Высокий", due: "30 мар", status: "Ожидание", assignee: "МБ", prog: 30 },
  { id: 3, title: "Обновление документации API", priority: "Средний", due: "2 апр", status: "В работе", assignee: "ДН", prog: 55 },
  { id: 4, title: "Аудит прав доступа", priority: "Низкий", due: "5 апр", status: "Не начато", assignee: "АС", prog: 0 },
  { id: 5, title: "Интеграция с ГБД ФЛ", priority: "Высокий", due: "7 апр", status: "В работе", assignee: "МБ", prog: 44 },
];

export const EVENTS = [
  { id: 1, title: "Оперативное совещание", time: "10:00", end: "10:30", tag: "Онлайн", color: C.blue, attendees: ["АС", "МБ", "ДН"] },
  { id: 2, title: "Встреча с руководством", time: "12:00", end: "12:45", tag: "Зал А", color: C.purple, attendees: ["АС", "МБ"] },
  { id: 3, title: "Презентация результатов Q1", time: "15:00", end: "16:00", tag: "Онлайн", color: C.green, attendees: ["МБ", "ДН", "АИ"] },
];

export const NOTIFICATIONS = [
  { id: 1, icon: "event", title: "Новое приглашение на встречу", sub: "Команда цифровых сервисов · 5 мин", read: false, color: C.blue },
  { id: 2, icon: "task_alt", title: "Задача «Отчёт Q1» выполнена", sub: "Исполнитель: А. Сейткали · 1 ч", read: false, color: C.green },
  { id: 3, icon: "description", title: "Документ обновлён: Бюджет Q2", sub: "Хранилище · Вчера, 17:42", read: true, color: C.inkMuted },
  { id: 4, icon: "person_add", title: "Новый участник добавлен", sub: "Проект «Цифровой архив» · Вчера", read: true, color: C.inkMuted },
];

export const NAV_GROUPS = [
  {
    label: "Рабочее пространство",
    items: [
      { id: "home", icon: "grid_view", label: "Главная" },
      { id: "tasks", icon: "check_circle", label: "Задачи", badge: 5 },
      { id: "calendar", icon: "calendar_month", label: "Календарь", badge: 3 },
      { id: "docs", icon: "folder", label: "Документы" },
      { id: "chat", icon: "forum", label: "Сообщения", badge: 2 },
    ],
  },
  {
    label: "Управление",
    items: [
      { id: "analytics", icon: "bar_chart_4_bars", label: "Аналитика" },
      { id: "people", icon: "group", label: "Сотрудники" },
      { id: "settings", icon: "settings", label: "Настройки" },
    ],
  },
];

export const WEEK_DAYS = [
  { d: "Пн", n: "24" }, { d: "Вт", n: "25" }, { d: "Ср", n: "26" },
  { d: "Чт", n: "27" }, { d: "Пт", n: "28" }, { d: "Сб", n: "29" }, { d: "Вс", n: "30" },
];
export const SERVICES = [
  { icon: "videocam", label: "Meetings", count: "3 сегодня", color: C.blue },
  { icon: "folder", label: "Хранилище", count: "14 файлов", color: C.green },
  { icon: "view_kanban", label: "Доска", count: "5 задач", color: C.purple },
  { icon: "mail", label: "Почта", count: "12 писем", color: C.amber },
  { icon: "bar_chart_4_bars", label: "Аналитика", count: "Обновлено", color: C.red },
  { icon: "auto_awesome", label: "AI-чат", count: "Онлайн", color: C.blue },
];
