export const SIDEBAR_THEME = {
  sb: '#08111E',
  sbBorder: 'rgba(255,255,255,0.06)',
  sbText: 'rgba(255,255,255,0.38)',
  sbTextHover: 'rgba(255,255,255,0.72)',
  sbHover: 'rgba(255,255,255,0.04)',
  sbActive: 'rgba(30,136,229,0.14)',
  sbActiveText: '#ffffff',
  blue: '#1E88E5',
  blueDark: '#0D47A1',
  blueDeep: '#061A40',
  blueGlow: 'rgba(30,136,229,0.18)',
} as const

export interface WorkspaceNavItem {
  id: string
  icon: string
  label: string
  badge?: number
}

export interface WorkspaceNavGroup {
  label: string
  items: WorkspaceNavItem[]
}

export const WORKSPACE_NAV_GROUPS: WorkspaceNavGroup[] = [
  {
    label: 'Рабочее пространство',
    items: [
      { id: 'home', icon: 'grid_view', label: 'Главная' },
      { id: 'workspace', icon: 'apps', label: 'Workspace' },
      { id: 'calendar', icon: 'calendar_month', label: 'Календарь' },
      { id: 'alemstore', icon: 'storefront', label: 'AlemStore' },
      { id: 'profile', icon: 'badge', label: 'Profile' },
      // { id: 'tasks', icon: 'check_circle', label: 'Задачи', badge: 5 },
      // { id: 'docs', icon: 'folder', label: 'Документы' },
      { id: 'chat', icon: 'forum', label: 'Сообщения', badge: 2 },
    ],
  },
  // {
  //   label: 'Управление',
  //   items: [
  //     { id: 'analytics', icon: 'bar_chart_4_bars', label: 'Аналитика' },
  //     { id: 'people', icon: 'group', label: 'Сотрудники' },
  //     { id: 'settings', icon: 'settings', label: 'Настройки' },
  //   ],
  // },
]
