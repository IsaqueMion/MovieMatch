import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ComponentProps } from 'react'

type Props = ComponentProps<'button'> & {
  direction?: 'diagonal' | 'down' | 'right'
  tone?: 'primary' | 'secondary' | 'light'
  compact?: boolean
}

/** Expanding circle adapted from the supplied reference; arrows travel in their own direction. */
export default function CinemaButton({ children, direction = 'diagonal', tone = 'primary', compact = false, className = '', type = 'button', ...props }: Props) {
  const Icon = direction === 'down' ? ArrowDown : direction === 'right' ? ArrowRight : ArrowUpRight
  return (
    <button type={type} className={`cinema-button cinema-button-${tone} cinema-button-${direction}${compact ? ' is-compact' : ''} ${className}`} {...props}>
      <span className="cinema-button-circle" aria-hidden="true" />
      <span className="cinema-button-text">{children}</span>
      <span className="cinema-button-arrow" aria-hidden="true"><Icon size={18} /></span>
    </button>
  )
}
