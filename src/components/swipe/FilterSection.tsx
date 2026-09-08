import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

type Props = {
  title: string
  description?: string
  icon: ReactNode
  badge?: number
  defaultOpen?: boolean
  children: ReactNode
}

export default function FilterSection({
  title,
  description,
  icon,
  badge = 0,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.035] sm:px-5"
        aria-expanded={open}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-emerald-300 ring-1 ring-white/10">
          {icon}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-medium text-white">{title}</span>

            {badge > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                {badge}
              </span>
            ) : null}
          </span>

          {description ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-white/50">
              {description}
            </span>
          ) : null}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 pb-5 pt-4 sm:px-5">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
