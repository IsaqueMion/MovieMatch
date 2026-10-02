import {
  lazy,
  Suspense,
} from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import JoinRedirect from './pages/JoinRedirect'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import SessionLoader from './components/ui/session-loader'
import BackToTop from './components/ui/back-to-top'

const Swipe = lazy(
  () => import('./pages/Swipe'),
)

const Matches = lazy(
  () => import('./pages/Matches'),
)
const Watched = lazy(() => import('./pages/Watched'))
const Account = lazy(() => import('./pages/Account'))
const Profile = lazy(() => import('./pages/Profile'))

function RouteLoading() {
  return (
    <main
      className="min-h-dvh grid place-items-center bg-neutral-900 p-6 text-white"
      aria-live="polite"
      aria-busy="true"
    >
      <SessionLoader />
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <BackToTop />
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
          <Route path="/assistidos" element={<Watched />} />
          <Route path="/s/:code/assistidos" element={<Watched />} />
          <Route path="/conta" element={<Account />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/p/:handle" element={<Profile />} />
          <Route path="/salas" element={<Navigate to="/#minhas-salas" replace />} />
          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
