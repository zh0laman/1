import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-4 text-base font-bold tracking-tight text-[#0A1628] first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3 text-[15px] font-bold tracking-tight text-[#0A1628] first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-3 text-sm font-bold text-[#0A1628] first:mt-0" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-[#0A1628] first:mt-0" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-[#0A1628]" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-[#29405F]" {...props}>
      {children}
    </em>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0A1628]" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#0A1628]" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-6" {...props}>
      {children}
    </li>
  ),
  a: ({ children, ...props }) => (
    <a
      className="font-medium text-[#1E88E5] underline-offset-2 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="mt-2 border-l-4 border-[#C8D5E8] pl-3 text-sm text-[#4D6486]" {...props}>
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-[#E2E8F0]" />,
  pre: ({ children, ...props }) => (
    <pre
      className="mt-2 overflow-x-auto rounded-xl border border-[#DDE3EE] bg-[#F8F9FD] p-3 text-xs leading-relaxed text-[#0A1628]"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const raw = String(children).replace(/\n$/, '')
    const isBlock = Boolean(className?.startsWith('language-')) || raw.includes('\n')
    if (!isBlock) {
      return (
        <code
          className="rounded bg-[#EDF2F7] px-1 py-0.5 font-mono text-[12px] text-[#1e3a5f]"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code className={`block whitespace-pre font-mono text-xs text-[#0A1628] ${className ?? ''}`} {...props}>
        {children}
      </code>
    )
  },
  table: ({ children, ...props }) => (
    <div className="mt-2 max-w-full overflow-x-auto">
      <table className="w-full min-w-[240px] border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-[#DDE3EE] bg-[#F8F9FD] px-2 py-1.5 text-left text-xs font-semibold text-[#0A1628]"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-[#DDE3EE] px-2 py-1.5 text-xs text-[#29405F]" {...props}>
      {children}
    </td>
  ),
}

interface TaskDescriptionMarkdownProps {
  source: string
  className?: string
  emptyLabel?: string
}

export default function TaskDescriptionMarkdown({
  source,
  className = '',
  emptyLabel = 'Нет текста',
}: TaskDescriptionMarkdownProps) {
  const text = source?.trim() ?? ''
  if (!text) {
    return <p className="text-sm text-[#8497B4]">{emptyLabel}</p>
  }
  return (
    <div className={`task-md text-[#0A1628] ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
