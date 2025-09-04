// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Session from './pages/Session'
import Swipe from './pages/Swipe'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/s/:code" element={<Session />} />
        <Route path="/swipe/:code" element={<Swipe />} />
      </Routes>
    </BrowserRouter>
  )
}
