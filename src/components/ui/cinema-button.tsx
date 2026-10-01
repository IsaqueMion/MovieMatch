import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ComponentProps } from 'react'
import SpecularButton from './SpecularButton'

type Props = ComponentProps<'button'> & {
  direction?: 'diagonal' | 'down' | 'right'
  tone?: 'primary' | 'secondary' | 'light'
  compact?: boolean
}

/** Expanding circle adapted from the supplied reference; arrows travel in their own direction. */
export default function CinemaButton({ children, direction = 'diagonal', tone = 'primary', compact = false, className = '', type = 'button', ...props }: Props) {
  const Icon = direction === 'down' ? ArrowDown : direction === 'right' ? ArrowRight : ArrowUpRight
  return (
    <SpecularButton unstyled size="lg" radius={compact ? 22 : 27} tint="#ffffff" tintOpacity={0} blur={0} textColor="#f5f5f5" lineColor="#ffffff" baseColor="#525252" intensity={1} shineSize={10} shineFade={40} thickness={1} speed={0.35} followMouse proximity={250} autoAnimate={false} delay={550} type={type} className={`cinema-button cinema-button-${tone} cinema-button-${direction}${compact ? ' is-compact' : ''} ${className}`} {...props}>
      <span className="cinema-button-circle" aria-hidden="true" />
      <span className="cinema-button-text">{children}</span>
      <span className="cinema-button-arrow" aria-hidden="true"><Icon size={18} /></span>
    </SpecularButton>
  )
}
