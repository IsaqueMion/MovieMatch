// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Swipe from './pages/Swipe'
import JoinRedirect from './pages/JoinRedirect'
import Matches from './pages/Matches'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
         <Route path="/s/:code" element={<Swipe />} />
        <Route path="/join" element={<JoinRedirect />} /> 
        <Route path="/s/:code/matches" element={<Matches />} />
      </Routes>
    </BrowserRouter>
  )
}
