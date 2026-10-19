const unavailable = () => new Error('Permita o armazenamento deste site no navegador para manter sua sessão e seus votos ao atualizar.')

function browserStore(): Storage | null {
  if (typeof window === 'undefined') return null
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const store = window[name]
      const key = 'mm:auth-storage-check'
      store.setItem(key, '1')
      store.removeItem(key)
      return store
    } catch { /* Privacy settings can block persistent storage but allow the tab. */ }
  }
  return null
}

const store = browserStore()
export const authStorage = {
  getItem: (key: string) => store?.getItem(key) ?? null,
  setItem(key: string, value: string) {
    if (!store) throw unavailable()
    store.setItem(key, value)
  },
  removeItem: (key: string) => { store?.removeItem(key) },
}

export function requireAuthStorage(): void {
  if (!store) throw unavailable()
  const key = 'mm:auth-storage-check'
  store.setItem(key, '1')
  store.removeItem(key)
}
