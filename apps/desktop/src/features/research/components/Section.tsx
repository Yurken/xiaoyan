import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function Section({ title, description, children, className = '' }: SectionProps) {
  return (
    <section className={`rc-focus-card rounded-2xl p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--rc-text)' }}>
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}
