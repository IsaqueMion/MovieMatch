import {
  lazy,
  Suspense,
} from 'react'
import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom'

import JoinRedirect from './pages/JoinRedirect'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'

const Swipe = lazy(
  () => import('./pages/Swipe'),
)

const Matches = lazy(
  () => import('./pages/Matches'),
)

function RouteLoading() {
  return (
    <main
      className="min-h-dvh grid place-items-center bg-neutral-900 p-6 text-white"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
        <p className="mt-3 text-sm text-white/70">
          Carregando…
        </p>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route
            path="/"
            element={<Landing />}
          />
          <Route
            path="/join"
            element={<JoinRedirect />}
          />
          <Route
            path="/s/:code"
            element={<Swipe />}
          />
          <Route
            path="/s/:code/matches"
            element={<Matches />}
          />
          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
