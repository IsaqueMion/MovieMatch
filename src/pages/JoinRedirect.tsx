import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function JoinRedirect() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const code = (params.get('code') || '').toUpperCase()
    if (code) navigate(`/s/${code}`, { replace: true })
    else navigate('/', { replace: true })
  }, [params, navigate])

  return null
}
