import type { AlemContact } from '../../../domain/entities/AlemContact'

export type OrgNodeType = 'organization' | 'department' | 'employee_group' | 'employee'

export interface OrgTreeNode {
  id: string
  type: OrgNodeType
  label: string
  subtitle?: string
  contact?: AlemContact
  /** Сотрудники подразделения (для employee_group) */
  contacts?: AlemContact[]
  children: OrgTreeNode[]
  employeeCount?: number
}

const UNKNOWN_ORG = 'Организация не указана'
const UNKNOWN_DEPT = 'Подразделение не указано'

/** До этого числа показываем отдельные карточки на полотне */
const INDIVIDUAL_EMPLOYEE_CANVAS_LIMIT = 8

function normalizeLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

export function buildHrOrgTree(contacts: AlemContact[]): OrgTreeNode[] {
  const orgMap = new Map<string, Map<string, AlemContact[]>>()

  for (const contact of contacts) {
    const org = normalizeLabel(contact.organization, UNKNOWN_ORG)
    const dept = normalizeLabel(contact.department_unit, UNKNOWN_DEPT)

    if (!orgMap.has(org)) {
      orgMap.set(org, new Map())
    }
    const deptMap = orgMap.get(org)!
    if (!deptMap.has(dept)) {
      deptMap.set(dept, [])
    }
    deptMap.get(dept)!.push(contact)
  }

  const orgNodes: OrgTreeNode[] = []

  for (const [orgName, deptMap] of [...orgMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))) {
    const deptNodes: OrgTreeNode[] = []
    let orgEmployeeCount = 0

    for (const [deptName, employees] of [...deptMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))) {
      const sortedEmployees = [...employees].sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '', 'ru'),
      )

      orgEmployeeCount += sortedEmployees.length

      let deptChildren: OrgTreeNode[]

      if (sortedEmployees.length === 0) {
        deptChildren = []
      } else if (sortedEmployees.length <= INDIVIDUAL_EMPLOYEE_CANVAS_LIMIT) {
        deptChildren = sortedEmployees.map((contact) => ({
          id: `emp-${contact.id}`,
          type: 'employee',
          label: contact.full_name?.trim() || contact.email,
          subtitle: normalizeLabel(contact.position ?? contact.job_name, 'Должность не указана'),
          contact,
          children: [],
        }))
      } else {
        deptChildren = [
          {
            id: `group-${orgName}-${deptName}`.replace(/\s+/g, '_'),
            type: 'employee_group',
            label: `${sortedEmployees.length} сотрудников`,
            subtitle: 'Нажмите, чтобы открыть список',
            contacts: sortedEmployees,
            children: [],
            employeeCount: sortedEmployees.length,
          },
        ]
      }

      deptNodes.push({
        id: `dept-${orgName}-${deptName}`.replace(/\s+/g, '_'),
        type: 'department',
        label: deptName,
        subtitle: `${sortedEmployees.length} сотр.`,
        children: deptChildren,
        employeeCount: sortedEmployees.length,
      })
    }

    orgNodes.push({
      id: `org-${orgName}`.replace(/\s+/g, '_'),
      type: 'organization',
      label: orgName,
      subtitle: `${deptNodes.length} подразд. · ${orgEmployeeCount} сотр.`,
      children: deptNodes,
      employeeCount: orgEmployeeCount,
    })
  }

  return orgNodes
}

export interface LayoutRect {
  node: OrgTreeNode
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutEdge {
  fromId: string
  toId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const CARD_SIZE: Record<OrgNodeType, { w: number; h: number; childGapX: number; levelGapY: number }> = {
  organization: { w: 340, h: 72, childGapX: 24, levelGapY: 56 },
  department: { w: 260, h: 64, childGapX: 16, levelGapY: 48 },
  employee_group: { w: 200, h: 52, childGapX: 12, levelGapY: 0 },
  employee: { w: 200, h: 52, childGapX: 10, levelGapY: 0 },
}

const DEPT_GRID_COLUMNS = 3

function layoutChildrenGrid(
  node: OrgTreeNode,
  children: OrgTreeNode[],
  startX: number,
  startY: number,
): { rects: LayoutRect[]; edges: LayoutEdge[]; width: number; height: number } {
  const size = CARD_SIZE[node.type]
  const cols = node.type === 'organization' ? DEPT_GRID_COLUMNS : Math.min(4, children.length)
  const rows = Math.ceil(children.length / cols)

  const cellWidths: number[] = []
  const cellHeights: number[] = []
  const childLayouts: Array<{ rects: LayoutRect[]; edges: LayoutEdge[]; width: number; height: number }> = []

  for (let i = 0; i < children.length; i++) {
    const laid = layoutSubtree(children[i], 0, 0)
    childLayouts.push(laid)
  }

  for (let row = 0; row < rows; row++) {
    let rowWidth = 0
    let rowHeight = 0
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      if (idx >= childLayouts.length) break
      rowWidth += childLayouts[idx].width + size.childGapX
      rowHeight = Math.max(rowHeight, childLayouts[idx].height)
    }
    cellWidths.push(Math.max(0, rowWidth - size.childGapX))
    cellHeights.push(rowHeight)
  }

  const gridWidth = Math.max(...cellWidths, size.w)
  const gridHeight = cellHeights.reduce((sum, h) => sum + h + size.childGapX, 0) - size.childGapX

  const rects: LayoutRect[] = []
  const edges: LayoutEdge[] = []
  let gridY = startY

  for (let row = 0; row < rows; row++) {
    let rowX = startX
    const rowH = cellHeights[row] ?? 0
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      if (idx >= childLayouts.length) break
      const laid = childLayouts[idx]
      const offsetX = rowX
      const offsetY = gridY
      for (const r of laid.rects) {
        rects.push({ ...r, x: r.x + offsetX, y: r.y + offsetY })
      }
      for (const e of laid.edges) {
        edges.push({ ...e, x1: e.x1 + offsetX, y1: e.y1 + offsetY, x2: e.x2 + offsetX, y2: e.y2 + offsetY })
      }
      rowX += laid.width + size.childGapX
    }
    gridY += rowH + size.childGapX
  }

  return { rects, edges, width: gridWidth, height: gridHeight }
}

function layoutSubtree(node: OrgTreeNode, startX: number, startY: number): {
  rects: LayoutRect[]
  edges: LayoutEdge[]
  width: number
  height: number
} {
  const size = CARD_SIZE[node.type]
  const selfRect: LayoutRect = {
    node,
    x: startX,
    y: startY,
    width: size.w,
    height: size.h,
  }

  if (node.children.length === 0) {
    return { rects: [selfRect], edges: [], width: size.w, height: size.h }
  }

  const childY = startY + size.h + size.levelGapY

  const useGrid = node.type === 'organization' || (node.type === 'department' && node.children.length > 2)

  const laid = useGrid
    ? layoutChildrenGrid(node, node.children, startX, childY)
    : layoutChildrenRow(node, node.children, startX, childY)

  const centeredX = startX + Math.max(0, (laid.width - size.w) / 2)
  selfRect.x = centeredX

  const edges: LayoutEdge[] = [...laid.edges]
  const rects: LayoutRect[] = [selfRect, ...laid.rects]

  for (let i = 0; i < node.children.length; i++) {
    const childRoot = laid.rects.find((r) => r.node.id === node.children[i].id)
    if (!childRoot) continue
    edges.push({
      fromId: node.id,
      toId: node.children[i].id,
      x1: selfRect.x + selfRect.width / 2,
      y1: selfRect.y + selfRect.height,
      x2: childRoot.x + childRoot.width / 2,
      y2: childRoot.y,
    })
  }

  const width = Math.max(size.w, laid.width)
  const height = size.h + size.levelGapY + laid.height

  return { rects, edges, width, height }
}

function layoutChildrenRow(
  node: OrgTreeNode,
  children: OrgTreeNode[],
  startX: number,
  startY: number,
): { rects: LayoutRect[]; edges: LayoutEdge[]; width: number; height: number } {
  const size = CARD_SIZE[node.type]
  let cursorX = startX
  const allRects: LayoutRect[] = []
  const allEdges: LayoutEdge[] = []
  let maxChildHeight = 0

  for (const child of children) {
    const laid = layoutSubtree(child, cursorX, startY)
    allRects.push(...laid.rects)
    allEdges.push(...laid.edges)
    cursorX += laid.width + size.childGapX
    maxChildHeight = Math.max(maxChildHeight, laid.height)
  }

  const totalWidth = Math.max(0, cursorX - startX - size.childGapX)
  return { rects: allRects, edges: allEdges, width: totalWidth, height: maxChildHeight }
}

/** Организации идут столбиком — удобнее, чем одна длинная горизонтальная лента */
export function layoutOrgForest(roots: OrgTreeNode[]): {
  rects: LayoutRect[]
  edges: LayoutEdge[]
  width: number
  height: number
} {
  let cursorY = 0
  const gapY = 80
  const allRects: LayoutRect[] = []
  const allEdges: LayoutEdge[] = []
  let maxWidth = 0

  for (const root of roots) {
    const laid = layoutSubtree(root, 0, cursorY)
    allRects.push(...laid.rects)
    allEdges.push(...laid.edges)
    cursorY += laid.height + gapY
    maxWidth = Math.max(maxWidth, laid.width)
  }

  const totalHeight = Math.max(0, cursorY - gapY)
  return { rects: allRects, edges: allEdges, width: maxWidth, height: totalHeight }
}

/** Плоский список для бокового дерева навигации */
export function flattenOrgTree(nodes: OrgTreeNode[], depth = 0): Array<{ node: OrgTreeNode; depth: number }> {
  const out: Array<{ node: OrgTreeNode; depth: number }> = []
  for (const node of nodes) {
    if (node.type === 'employee') continue
    out.push({ node, depth })
    out.push(...flattenOrgTree(node.children, depth + 1))
  }
  return out
}
