import { Routes, Route } from 'react-router'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import MobileShell from './pages/MobileShell'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={<AdminDashboard />} />
      <Route path="/*" element={<MobileShell />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
