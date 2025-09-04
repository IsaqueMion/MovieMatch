import { Toaster } from 'sonner'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Landing from './pages/Landing'

export default function App() {
  return (
    <BrowserRouter>
      <header className="p-4 border-b">
        <nav className="max-w-5xl mx-auto flex gap-4">
          <Link to="/" className="font-medium">Início</Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </main>

      <Toaster richColors />
    </BrowserRouter>
  )
}
