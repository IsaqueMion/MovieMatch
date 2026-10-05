import type { ReactNode } from 'react'

export default function FilterSection({ title, description, active, children }: {
  title: string
  description?: string
  active: boolean
  children: ReactNode
}) {
  return <section className="filter-section" hidden={!active} aria-label={title}>
    <header className="filter-section-heading"><h3>{title}</h3><p>{description}</p></header>
    {children}
  </section>
}
