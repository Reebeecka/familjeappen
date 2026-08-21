import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import NotificationButton from '../components/NotificationButton'

export default function Home() {
  const { profile, householdId } = useAuth()
  const [household, setHousehold] = useState(null)
  const [counts, setCounts] = useState({ tasks: 0, shopping: 0 })

  useEffect(() => {
    if (!householdId) return

    supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single()
      .then(({ data }) => setHousehold(data))

    const loadCounts = async () => {
      const [tasks, shopping] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('done', false),
        supabase
          .from('shopping_items')
          .select('id', { count: 'exact', head: true })
          .eq('checked', false),
      ])
      setCounts({ tasks: tasks.count ?? 0, shopping: shopping.count ?? 0 })
    }
    loadCounts()
  }, [householdId])

  return (
    <div className="page">
      <h1 className="page-title">Hej {profile?.display_name || 'där'}! 👋</h1>

      {household && (
        <div className="card invite-card">
          <p className="muted">Hushåll</p>
          <p className="household-name">{household.name}</p>
          <p className="muted">Dela denna kod med din partner så ni delar allt:</p>
          <p className="invite-code">{household.invite_code}</p>
        </div>
      )}

      <NotificationButton />

      <div className="dashboard-grid">
        <Link to="/uppgifter" className="card dash-card">
          <span className="dash-icon">✅</span>
          <span className="dash-label">Uppgifter</span>
          <span className="dash-count">{counts.tasks} kvar</span>
        </Link>
        <Link to="/inkop" className="card dash-card">
          <span className="dash-icon">🛒</span>
          <span className="dash-label">Inköp</span>
          <span className="dash-count">{counts.shopping} kvar</span>
        </Link>
      </div>

      <p className="muted small">
        Fler funktioner (kalender, budget, måltider, dokument) läggs till fas för fas – se
        PLANERING.md.
      </p>
    </div>
  )
}
