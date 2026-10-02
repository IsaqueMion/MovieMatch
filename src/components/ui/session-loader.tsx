import type { CSSProperties } from 'react'
import { useLocale } from '../../hooks/useLocale'

const BARS = Array.from({ length: 24 }, (_, index) => index)
const LEVELS = [0, 1, 2, 3]

export default function SessionLoader({ label = 'Carregando sessão…' }: { label?: string }) {
  const { t } = useLocale()
  return (
    <div className="cinema-session-loader" role="status" aria-busy="true">
      <div className="cinema-wave-orb" aria-hidden="true">
        {LEVELS.map(level => <div key={level} className="cinema-wave" data-level={level}>
          {BARS.map(index => <span key={index} className="cinema-wave-bar" style={{ '--bar-index': index } as CSSProperties} />)}
        </div>)}
      </div>
      <span className="sr-only">{t(label)}</span>
    </div>
  )
}
