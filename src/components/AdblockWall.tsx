import { useEffect, useState } from 'react'

type Props = { enabled?: boolean }

export default function AdblockWall({ enabled = true }: Props) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let flagged = false
    const flag = () => {
      if (!flagged) {
        flagged = true
        setActive(true)
      }
    }

    // Teste 1: “bait” que adblock costuma esconder por CSS
    const bait = document.createElement('div')
    bait.className = 'adsbygoogle adsbox ad-banner ad-unit'
    bait.style.cssText =
      'width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;pointer-events:none;'
    document.body.appendChild(bait)
    setTimeout(() => {
      try {
        const cs = getComputedStyle(bait)
        const hidden =
          cs.display === 'none' ||
          cs.visibility === 'hidden' ||
          bait.offsetParent === null ||
          bait.offsetHeight === 0 ||
          bait.offsetWidth === 0
        if (hidden) flag()
      } catch {
        /* ignore */
      } finally {
        bait.remove()
      }
    }, 120)

    // Teste 2: tentar carregar a tag do Google (muitos adblocks bloqueiam o request)
    const s = document.createElement('script')
    s.async = true
    s.src =
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?mm_bait=1'
    s.onload = () => {
      /* ok, não sinaliza */
    }
    s.onerror = () => {
      flag()
    }
    document.head.appendChild(s)

    // Teste 3: fallback por timeout — se nada carregou e não existe adsbygoogle, sinaliza
    const t = setTimeout(() => {
      if (!(window as any).adsbygoogle) flag()
    }, 1500)

    return () => {
      clearTimeout(t)
      try { s.remove() } catch {}
      try { bait.remove() } catch {}
    }
  }, [enabled])

  if (!enabled || !active) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="w-[min(92vw,34rem)] rounded-2xl bg-neutral-900 p-5 text-white shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-pink-500 text-black">
            <span role="img" aria-label="escudo">🛡️</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold">Ajude a manter o MovieMatch gratuito</h3>
            <p className="mt-1 text-sm text-white/80">
              Detectamos um bloqueador de anúncios. Nossos anúncios são discretos e
              ajudam a pagar os servidores. Desative o adblock para este site e clique
              em <strong>“Já desativei”</strong>.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <a
            href="https://support.google.com/adsense/answer/1348688?hl=pt-BR"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/15"
          >
            Como desativar
          </a>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-white hover:bg-emerald-600"
          >
            Já desativei
          </button>
        </div>

        <div className="mt-3 text-xs text-white/60">
          Em breve teremos opção <strong>Premium</strong> para remover anúncios.
        </div>
      </div>
    </div>
  )
}
