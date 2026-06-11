import type { LucideIcon } from 'lucide-react'
import { Building2, GitBranch, User, Users } from 'lucide-react'
import type { OrgNodeType } from './buildHrOrgTree'

export interface OrgNodeVisual {
  Icon: LucideIcon
  bg: string
  color: string
  label: string
}

export const ORG_NODE_VISUALS: Record<OrgNodeType, OrgNodeVisual> = {
  organization: {
    Icon: Building2,
    bg: '#E3F2FD',
    color: '#1565C0',
    label: 'Организация',
  },
  department: {
    Icon: GitBranch,
    bg: '#E8F5E9',
    color: '#2E7D32',
    label: 'Подразделение',
  },
  employee_group: {
    Icon: Users,
    bg: '#FFF3E0',
    color: '#E65100',
    label: 'Сотрудники',
  },
  employee: {
    Icon: User,
    bg: '#F3E5F5',
    color: '#6A1B9A',
    label: 'Сотрудник',
  },
}

export function OrgNodeIconBadge({
  type,
  size = 28,
  iconSize = 15,
}: {
  type: OrgNodeType
  size?: number
  iconSize?: number
}) {
  const { Icon, bg, color } = ORG_NODE_VISUALS[type]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, backgroundColor: bg, color }}
      aria-hidden
    >
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  )
}
