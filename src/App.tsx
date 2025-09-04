// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Session from './pages/Session'
import Swipe from './pages/Swipe'
import JoinRedirect from './pages/JoinRedirect'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/s/:code" element={<Session />} />
        <Route path="/swipe/:code" element={<Swipe />} />
        <Route path="/join" element={<JoinRedirect />} /> 
      </Routes>
    </BrowserRouter>
  )
}
