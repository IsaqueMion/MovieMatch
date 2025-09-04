import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Gera um código curtinho tipo "ABCD12"
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function Landing() {
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  // Faz login anônimo ao abrir a página
  useEffect(() => {
    (async () => {
      setStatus('Conectando...')
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user) {
        const { data, error: signErr } = await supabase.auth.signInAnonymously()
        if (signErr) {
          setStatus('Erro ao logar anonimamente: ' + signErr.message)
          return
        }
        setUserId(data.user?.id ?? null)
        setStatus('Usuário anônimo conectado ✅')
      } else {
        setUserId(user.id)
        setStatus('Usuário anônimo conectado ✅')
      }
    })()
  }, [])

  async function criarSessao() {
    if (!userId) return alert('Aguarde conectar...')
    setStatus('Criando sessão...')
    const code = genCode()
    const { data: sessao, error } = await supabase
      .from('sessions')
      .insert({ code })
      .select()
      .single()
    if (error) return setStatus('Erro ao criar sessão: ' + error.message)

    // adiciona você como membro
    const { error: errM } = await supabase
      .from('session_members')
      .insert({ session_id: sessao.id, user_id: userId })
    if (errM) return setStatus('Sessão criada, mas falhou ao entrar: ' + errM.message)

    setStatus(`Sessão criada! Código: ${sessao.code}`)
    alert(`Sessão criada!\nCódigo: ${sessao.code}\nCompartilhe com seus amigos.`)
  }

  async function entrarSessao() {
    if (!userId) return alert('Aguarde conectar...')
    const code = prompt('Digite o código da sessão (ex.: ABCD12):')
    if (!code) return

    setStatus('Procurando sessão...')
    const { data: sessao, error } = await supabase
      .from('sessions')
      .select('id, code')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !sessao) {
      return setStatus('Sessão não encontrada.')
    }

    // adiciona você como membro (idempotente)
    const { error: errM } = await supabase
      .from('session_members')
      .insert({ session_id: sessao.id, user_id: userId })
      .select()
      .single()

    if (errM && !String(errM.message).includes('duplicate')) {
      return setStatus('Erro ao entrar: ' + errM.message)
    }

    setStatus(`Você entrou na sessão ${sessao.code} ✅`)
    alert(`Você entrou na sessão ${sessao.code}!`)
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold">MovieMatch (MVP)</h1>
        <p className="text-sm text-gray-600">{status}</p>

        <div className="grid gap-3">
          <button
            onClick={criarSessao}
            className="px-4 py-2 rounded-lg bg-black text-white"
          >
            Criar sessão
          </button>

          <button
            onClick={entrarSessao}
            className="px-4 py-2 rounded-lg border"
          >
            Entrar em sessão (com código)
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Dica: clique em “Criar sessão”, copie o código e depois teste “Entrar” colando o mesmo código.
        </p>
      </div>
    </div>
  )
}
