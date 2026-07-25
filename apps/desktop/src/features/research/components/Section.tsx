import type { ReactNode } from 'react'
import { Card, CardHeader, CardTitle } from '@research-copilot/ui'

interface SectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function Section({ title, description, children, className = '' }: SectionProps) {
  return (
    <Card className={className} padding="md">
      <CardHeader className="mb-4 px-0 pt-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="mt-1 text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
      </CardHeader>
      {children}
    </Card>
  )
}
