import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

type Option = {
  value: string
  label: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: readonly Option[]
  placeholder?: string
  className?: string
}

type MenuPosition = {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] =
    useState<MenuPosition | null>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find(
    (option) => option.value === value,
  )

  const updatePosition = useCallback(() => {
    const button = buttonRef.current

    if (!button) return

    const rect = button.getBoundingClientRect()

    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    const margin = 8
    const gap = 6

    const spaceBelow =
      viewportHeight - rect.bottom - margin

    const spaceAbove =
      rect.top - margin

    const preferAbove =
      spaceBelow < 220 &&
      spaceAbove > spaceBelow

    const availableSpace = preferAbove
      ? spaceAbove
      : spaceBelow

    const maxHeight = Math.max(
      120,
      Math.min(320, availableSpace - gap),
    )

    const width = Math.min(
      rect.width,
      viewportWidth - margin * 2,
    )

    const left = Math.min(
      Math.max(margin, rect.left),
      viewportWidth - width - margin,
    )

    if (preferAbove) {
      setMenuPosition({
        left,
        width,
        bottom:
          viewportHeight -
          rect.top +
          gap,
        maxHeight,
      })
    } else {
      setMenuPosition({
        left,
        width,
        top: rect.bottom + gap,
        maxHeight,
      })
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }

    updatePosition()

    const handleViewportChange = () => {
      updatePosition()
    }

    window.addEventListener(
      'resize',
      handleViewportChange,
    )

    window.addEventListener(
      'scroll',
      handleViewportChange,
      true,
    )

    return () => {
      window.removeEventListener(
        'resize',
        handleViewportChange,
      )

      window.removeEventListener(
        'scroll',
        handleViewportChange,
        true,
      )
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (
      event: MouseEvent,
    ) => {
      const target = event.target as Node

      const clickedButton =
        buttonRef.current?.contains(target)

      const clickedMenu =
        menuRef.current?.contains(target)

      if (!clickedButton && !clickedMenu) {
        setOpen(false)
      }
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener(
      'mousedown',
      handlePointerDown,
    )

    document.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handlePointerDown,
      )

      document.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [open])

  function choose(option: Option) {
    onChange(option.value)
    setOpen(false)

    requestAnimationFrame(() => {
      buttonRef.current?.focus()
    })
  }

  return (
    <>
      <div
        className={`relative ${className}`}
        data-interactive="true"
      >
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              updatePosition()
            }

            setOpen((current) => !current)
          }}
          className="
            flex min-h-10 w-full
            items-center justify-between
            gap-2 rounded-xl
            border border-white/10
            bg-neutral-950/30
            px-3 py-2
            text-left text-sm text-white
            transition
            hover:border-white/20
            hover:bg-white/[0.055]
            focus:outline-none
            focus:ring-2
            focus:ring-emerald-400/20
          "
        >
          <span
            className={
              selected
                ? 'truncate text-white/90'
                : 'truncate text-white/45'
            }
          >
            {selected?.label ?? placeholder}
          </span>

          <svg
            className={`h-4 w-4 shrink-0 text-white/45 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open &&
      menuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              data-interactive="true"
              className="
                fixed z-[9999]
                overflow-hidden
                rounded-xl
                border border-white/10
                bg-neutral-900/95
                shadow-2xl
                backdrop-blur-xl
              "
              style={{
                left: menuPosition.left,
                width: menuPosition.width,
                top: menuPosition.top,
                bottom: menuPosition.bottom,
              }}
            >
              <div
                role="listbox"
                className="
                  overflow-y-auto
                  overscroll-contain
                  py-1.5
                  [scrollbar-width:thin]
                "
                style={{
                  maxHeight:
                    menuPosition.maxHeight,
                }}
              >
                {options.map((option) => {
                  const isSelected =
                    option.value === value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        choose(option)
                      }
                      className={`
                        flex w-full
                        items-center
                        justify-between
                        gap-3
                        px-3 py-2.5
                        text-left text-sm
                        transition
                        ${
                          isSelected
                            ? 'bg-emerald-400/10 text-emerald-200'
                            : 'text-white/75 hover:bg-white/[0.065] hover:text-white'
                        }
                      `}
                    >
                      <span className="truncate">
                        {option.label}
                      </span>

                      {isSelected ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
