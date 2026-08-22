import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/AuthContext'
import SetupNeeded from './pages/SetupNeeded'
import Login from './pages/Login'
import Home from './pages/Home'
import Lists from './pages/Lists'
import ListDetail from './pages/ListDetail'
import Menu from './pages/Menu'
import Calendar from './pages/Calendar'
import RecurringTasks from './pages/RecurringTasks'
import MealPlanner from './pages/MealPlanner'
import Budget from './pages/Budget'
import Contacts from './pages/Contacts'
import Documents from './pages/Documents'
import Recipes from './pages/Recipes'
import Profile from './pages/Profile'
import Chat from './pages/Chat'
import Search from './pages/Search'
import MyDay from './pages/MyDay'
import Settings from './pages/Settings'
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
        <Route path="/listor" element={<Lists />} />
        <Route path="/listor/:listId" element={<ListDetail />} />
        <Route path="/mer" element={<Menu />} />
        <Route path="/kalender" element={<Calendar />} />
        <Route path="/aterkommande" element={<RecurringTasks />} />
        <Route path="/maltider" element={<MealPlanner />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/kontakter" element={<Contacts />} />
        <Route path="/dokument" element={<Documents />} />
        <Route path="/recept" element={<Recipes />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/chatt" element={<Chat />} />
        <Route path="/sok" element={<Search />} />
        <Route path="/min-dag" element={<MyDay />} />
        <Route path="/installningar" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
