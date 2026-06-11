import type { ReactNode } from 'react'

interface CardShellProps {
  children: ReactNode
  className?: string
}

export default function CardShell({ children, className = '' }: CardShellProps) {
  return (
    <section
      className={[
        'rounded-[var(--mk-radius-xl)] border border-[var(--mk-border-soft)] bg-[var(--mk-surface-1)] shadow-[var(--mk-shadow-soft)]',
        className,
      ].join(' ')}
    >
      {children}
    </section>
  )
}
