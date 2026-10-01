import type { ComponentPropsWithRef } from 'react'
import SpecularButton from '../ui/SpecularButton'

/** Native filter controls with the original white React Bits highlight. */
export default function FilterButton({ className = '', ...props }: ComponentPropsWithRef<'button'>) {
  const radius = className.includes('rounded-full') ? 999 : className.includes('rounded') ? 12 : 0
  return <SpecularButton unstyled radius={radius} lineColor="#ffffff" baseColor="#525252" delay={150} className={`cinema-filter-button ${className}`} {...props} />
}
