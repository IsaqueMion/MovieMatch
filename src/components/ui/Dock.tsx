import { usePrefersReducedMotion as useReducedMotion } from '../../hooks/usePrefersReducedMotion'
// Source: https://reactbits.dev/r/Dock-TS-TW.json
// Adapted for native disabled buttons, existing voting controls and stable touch targets.
import { motion, useMotionValue, useSpring, useTransform, type MotionValue, type SpringOptions } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export type DockItemData = {
  id: string
  icon: ReactNode
  label: string
  shortcut?: string
  onClick?: () => void
  className?: string
  disabled?: boolean
}
export type DockProps = {
  items: DockItemData[]
  className?: string
  distance?: number
  panelHeight?: number
  baseItemSize?: number
  magnification?: number
  spring?: SpringOptions
  label?: string
  renderItem?: (item: DockItemData) => ReactNode
}

const defaultSpring = { mass: .1, stiffness: 150, damping: 12 }

function DockItem({ item, mouseX, spring, distance, baseItemSize, magnification, enabled, renderItem }: { item: DockItemData; mouseX: MotionValue<number>; spring: SpringOptions; distance: number; baseItemSize: number; magnification: number; enabled: boolean; renderItem?: DockProps['renderItem'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: baseItemSize, height: baseItemSize })
  useEffect(() => {
    const button = ref.current?.querySelector('button')
    if (!button) return
    const measure = () => setDimensions({ width: button.offsetWidth, height: button.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(button)
    return () => observer.disconnect()
  }, [baseItemSize])
  const mouseDistance = useTransform(mouseX, value => {
    const rect = ref.current?.getBoundingClientRect()
    return rect ? value - rect.left - rect.width / 2 : Infinity
  })
  const targetScale = useTransform(mouseDistance, [-distance, 0, distance], [1, magnification / baseItemSize, 1])
  const scale = useSpring(targetScale, spring)
  const width = useTransform(scale, value => dimensions.width * value)
  const canMagnify = enabled && !item.disabled
  return <motion.div ref={ref} className="cinema-dock-item" style={{ width: canMagnify ? width : dimensions.width, height: dimensions.height + (item.shortcut ? 32 : 22) }} onFocus={() => {
    if (!canMagnify) return
    const bounds = ref.current?.getBoundingClientRect()
    if (bounds) mouseX.set(bounds.left + bounds.width / 2)
  }} onBlur={() => mouseX.set(Infinity)}>
    <motion.div className="cinema-dock-control" style={{ scale: canMagnify ? scale : 1, transformOrigin: 'center bottom' }}>
      {renderItem ? renderItem(item) : <button type="button" className={`cinema-dock-default ${item.className ?? ''}`} disabled={item.disabled} onClick={item.onClick} aria-label={item.label} style={{ width: baseItemSize, height: baseItemSize }}>{item.icon}</button>}
    </motion.div>
    <span className={`cinema-dock-label${item.shortcut ? ' cinema-dock-shortcut' : ''}`} aria-hidden="true">{item.shortcut ? <kbd>{item.shortcut}</kbd> : null}{item.label}</span>
  </motion.div>
}

export default function Dock({ items, className = '', spring = defaultSpring, magnification = 70, distance = 200, panelHeight = 68, baseItemSize = 50, label = 'Seu voto', renderItem }: DockProps) {
  const mouseX = useMotionValue(Infinity)
  const reducedMotion = useReducedMotion()
  const [finePointer, setFinePointer] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setFinePointer(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const enabled = finePointer && !reducedMotion
  return <div className={`cinema-dock ${className}`} style={{ minHeight: panelHeight }} role="toolbar" aria-label={label} onPointerMove={event => {
    if (enabled && event.pointerType === 'mouse') mouseX.set(event.clientX)
  }} onPointerLeave={() => mouseX.set(Infinity)}>
    {items.map(item => <DockItem key={item.id} item={item} mouseX={mouseX} spring={spring} distance={distance} magnification={magnification} baseItemSize={baseItemSize} enabled={enabled} renderItem={renderItem} />)}
  </div>
}
