import {
  ArrowLeft,
  Clapperboard,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFound() {
  usePageMeta({
    title:
      'Página não encontrada — MovieMatch',
    description:
      'A página que você tentou acessar não existe no MovieMatch.',
    robots:
      'noindex,nofollow,noarchive',
  })

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 px-5 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-500">
          <Clapperboard className="h-6 w-6 text-neutral-950" />
        </div>

        <p className="mt-6 font-mono text-sm text-emerald-400">
          ERRO 404
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Essa página não entrou nos matches.
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/55">
          O endereço pode estar incorreto ou a
          página pode ter sido movida.
        </p>

        <Link
          to="/"
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o início
        </Link>
      </div>
    </main>
  )
}
