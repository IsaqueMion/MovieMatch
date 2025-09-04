import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase' // se não usar alias "@", troque para '../lib/supabase'

type Member = { user_id: string }

export default function Session() {
  const { code = '' } = useParams()
  const upperCode = String(code).toUpperCase()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)

      const { data: sessao } = await supabase
        .from('sessions')
        .select('id, code')
        .eq('code', upperCode)
        .single()

      if (!sessao) { setLoading(false); return }

      setSessionId(sessao.id)

      const { data: mems } = await supabase
        .from('session_members')
        .select('user_id')
        .eq('session_id', sessao.id)

      setMembers(mems ?? [])
      setLoading(false)
    })()
  }, [upperCode])

  function copyLink() {
    const url = `${location.origin}/s/${upperCode}`
    navigator.clipboard.writeText(url)
    alert('Link copiado!')
  }

  if (loading) {
    return <div className="max-w-xl mx-auto p-4"><p>Carregando...</p></div>
  }

  if (!sessionId) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-3">
        <p>Sessão não encontrada.</p>
        <Link to="/" className="text-blue-600 underline">Voltar</Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessão {upperCode}</h1>
        <button onClick={copyLink} className="px-3 py-1.5 rounded-lg border">
          Copiar link
        </button>
      </div>

      <p className="text-sm text-gray-600">ID interno: {sessionId}</p>

      <div>
        <h2 className="font-semibold mb-2">Membros</h2>
        <ul className="list-disc pl-6 text-sm">
          {members.map(m => <li key={m.user_id}>{m.user_id}</li>)}
          {members.length === 0 && <li>— nenhum membro ainda —</li>}
        </ul>
      </div>

      <Link to="/" className="text-blue-600 underline">Voltar ao início</Link>
    </div>
  )
}
