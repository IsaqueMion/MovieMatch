import { BrowserRouter, Route, Routes } from 'react-router-dom'

import JoinRedirect from './pages/JoinRedirect'
import Landing from './pages/Landing'
import Matches from './pages/Matches'
import Swipe from './pages/Swipe'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<JoinRedirect />} />
        <Route path="/s/:code" element={<Swipe />} />
        <Route path="/s/:code/matches" element={<Matches />} />
      </Routes>
    </BrowserRouter>
  )
}
