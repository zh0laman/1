import { useEffect, useMemo, useState } from 'react'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type { OrgTreeNode } from './buildHrOrgTree'
import { OrgNodeIconBadge } from './orgNodeVisuals'

function nodeMatchesFilter(node: OrgTreeNode, query: string): boolean {
  if (!query) return true
  const haystack = [node.label, node.subtitle, ...(node.contacts?.map((c) => c.full_name) ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function subtreeMatchesFilter(node: OrgTreeNode, query: string): boolean {
  if (!query) return true
  if (nodeMatchesFilter(node, query)) return true
  return node.children.some((child) => subtreeMatchesFilter(child, query))
}

function collectExpandableIds(nodes: OrgTreeNode[], query: string, out: Set<string>) {
  for (const node of nodes) {
    if (node.children.length > 0 && subtreeMatchesFilter(node, query)) {
      out.add(node.id)
      collectExpandableIds(node.children, query, out)
    }
  }
}

interface TreeRowProps {
  node: OrgTreeNode
  depth: number
  expandedIds: Set<string>
  selectedNodeId: string | null
  onToggle: (id: string) => void
  onSelect: (node: OrgTreeNode) => void
}

function TreeRow({ node, depth, expandedIds, selectedNodeId, onToggle, onSelect }: TreeRowProps) {
  const hasChildren = node.children.some((c) => c.type !== 'employee')
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedNodeId === node.id
  const childNodes = node.children.filter((c) => c.type !== 'employee')

  return (
    <div className="select-none">
      <div
        className="group flex min-w-0 items-stretch"
        style={{ paddingLeft: Math.max(0, depth) * 14 }}
      >
        <div className="flex w-6 shrink-0 items-center justify-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.id)
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#90A4AE] transition hover:bg-[#ECEFF1] hover:text-[#546E7A]"
              aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
            >
              <MaterialSymbol
                name="chevron_right"
                size={16}
                className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          ) : (
            <span className="h-6 w-6" aria-hidden />
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelect(node)}
          title={node.label}
          className={`mb-0.5 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
            isSelected
              ? 'bg-[#E3F2FD] shadow-[inset_0_0_0_1px_#90CAF9]'
              : 'hover:bg-[#F4F7FB]'
          }`}
        >
          <OrgNodeIconBadge type={node.type} size={28} iconSize={15} />
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-[12px] leading-tight ${isSelected ? 'font-semibold text-[#0D47A1]' : 'font-medium text-[#37474F]'}`}
            >
              {node.label}
            </span>
            {node.subtitle ? (
              <span className="mt-0.5 block truncate text-[10px] text-[#90A4AE]">{node.subtitle}</span>
            ) : null}
          </span>
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <div className="relative ml-[11px] border-l border-[#E4EAF2] pl-2">
          {childNodes.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface OrgNavigatorTreeProps {
  forest: OrgTreeNode[]
  selectedNodeId: string | null
  filterQuery: string
  onSelect: (node: OrgTreeNode) => void
}

export default function OrgNavigatorTree({
  forest,
  selectedNodeId,
  filterQuery,
  onSelect,
}: OrgNavigatorTreeProps) {
  const normalizedFilter = filterQuery.trim().toLowerCase()

  const visibleForest = useMemo(() => {
    if (!normalizedFilter) return forest
    return forest.filter((org) => subtreeMatchesFilter(org, normalizedFilter))
  }, [forest, normalizedFilter])

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(forest.map((o) => o.id)))

  useEffect(() => {
    if (!normalizedFilter) return
    const next = new Set<string>()
    collectExpandableIds(forest, normalizedFilter, next)
    setExpandedIds(next)
  }, [normalizedFilter, forest])

  useEffect(() => {
    if (normalizedFilter) return
    setExpandedIds(new Set(forest.map((o) => o.id)))
  }, [forest, normalizedFilter])

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const next = new Set<string>()
    collectExpandableIds(forest, '', next)
    setExpandedIds(next)
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-1 border-b border-[#F0F4FA] px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8497B4]">Дерево</p>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={expandAll}
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#1E88E5] hover:bg-[#E3F2FD]"
          >
            Все
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#90A4AE] hover:bg-[#F5F5F5]"
          >
            Свернуть
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-1.5 py-2">
        {visibleForest.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[#B0BEC5]">Ничего не найдено</p>
        ) : (
          visibleForest.map((org) => (
            <TreeRow
              key={org.id}
              node={org}
              depth={0}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onToggle={toggle}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
