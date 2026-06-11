import { SmartAgentWidgetRenderer as SharedSmartAgentWidgetRenderer } from '../../pages/alemai/smart-agent/components/SmartAgentWidgetRenderer'
import type { SmartAgentWidget } from '../../pages/alemai/smart-agent/types'

interface SmartAgentWidgetRendererProps {
  widget: SmartAgentWidget
  isSending?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  onSelect?: (selectionValue: string, displayText: string) => void
}

export function SmartAgentWidgetRenderer({
  widget,
  isSending = false,
  onConfirm,
  onCancel,
  onSelect,
}: SmartAgentWidgetRendererProps) {
  return (
    <SharedSmartAgentWidgetRenderer
      widget={widget}
      isSending={isSending}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onSelect={onSelect}
    />
  )
}
