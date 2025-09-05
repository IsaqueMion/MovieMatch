import { useEffect, useRef, useState } from 'react'

type Option = { value: string; label: string }

type Props = {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

/**
 * Select simples com menu suspenso (dark), sem libs externas.
 * - Usa data-interactive="true" para não iniciar drag do SwipeCard.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (!btnRef.current || !popRef.current) return
      if (!btnRef.current.contains(t) && !popRef.current.contains(t)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  return (
    <div className={`relative ${className}`} data-interactive="true">
      <button
        ref={btnRef}
        type="button"
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md
                   bg-white/10 hover:bg-white/15 text-white text-sm ring-1 ring-white/10"
        onClick={() => setOpen(o => !o)}
      >
        <span className={selected ? '' : 'text-white/70'}>
          {selected?.label ?? placeholder}
        </span>
        <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-50 bottom-full mb-1 left-0 w-full overflow-hidden rounded-lg
                    bg-neutral-900 text-white ring-1 ring-white/10 shadow-xl"
        >
          <ul className="max-h-60 overflow-auto py-1">
            {options.map(opt => {
              const isSel = opt.value === value
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`w-full text-left px-2.5 py-1.5 text-sm
                                ${isSel ? 'bg-white/10' : 'hover:bg-white/10'} focus:outline-none`}
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    data-interactive="true"
                  >
                    {opt.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
