import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/AuthContext'
import SetupNeeded from './pages/SetupNeeded'
import Login from './pages/Login'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Shopping from './pages/Shopping'
import Layout from './components/Layout'

export default function App() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) {
    return <SetupNeeded />
  }

  if (loading) {
    return (
      <div className="center-screen">
        <p>Laddar…</p>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/uppgifter" element={<Tasks />} />
        <Route path="/inkop" element={<Shopping />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
