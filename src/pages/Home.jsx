import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import ActivityFeed from '../components/ActivityFeed'
import NotificationButton from '../components/NotificationButton'
import './Home.css'

const QUICK_LINKS = [
  { to: '/listor', label: 'Listor', icon: '📝' },
  { to: '/kalender', label: 'Kalender', icon: '📅' },
  { to: '/maltider', label: 'Måltider', icon: '🍽️' },
  { to: '/budget', label: 'Budget', icon: '💰' },
  { to: '/recept', label: 'Recept', icon: '📖' },
  { to: '/dokument', label: 'Dokument', icon: '📁' },
]

const MEAL_LABELS = {
  frukost: 'Frukost',
  lunch: 'Lunch',
  middag: 'Middag',
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatEventTime(event) {
  if (event.all_day) return 'Heldag'
  return new Date(event.start_at).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Home() {
  const { profile, householdId } = useAuth()
  const [household, setHousehold] = useState(null)
  const [todayEvents, setTodayEvents] = useState([])
  const [todayMeals, setTodayMeals] = useState([])
  const [todayLoading, setTodayLoading] = useState(true)
  const [todayError, setTodayError] = useState(null)

  useEffect(() => {
    if (!householdId) return

    let active = true

    const loadHome = async () => {
      setTodayLoading(true)
      setTodayError(null)

      const today = new Date()
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const dateKey = toDateKey(today)
      const [householdResult, eventsResult, mealsResult] = await Promise.all([
        supabase
          .from('households')
          .select('name, invite_code')
          .eq('id', householdId)
          .single(),
        supabase
          .from('calendar_events')
          .select('id, title, start_at, all_day, color')
          .eq('household_id', householdId)
          .gte('start_at', startOfToday.toISOString())
          .lt('start_at', tomorrow.toISOString())
          .order('start_at', { ascending: true }),
        supabase
          .from('meals')
          .select('id, title, meal_type')
          .eq('household_id', householdId)
          .eq('meal_date', dateKey)
          .order('meal_type', { ascending: true }),
      ])

      if (!active) return

      setHousehold(householdResult.data)
      setTodayEvents(eventsResult.data ?? [])
      setTodayMeals(mealsResult.data ?? [])
      if (eventsResult.error || mealsResult.error) {
        setTodayError('Dagens översikt kunde inte laddas.')
      }
      setTodayLoading(false)
    }

    loadHome()

    return () => {
      active = false
    }
  }, [householdId])

  return (
    <div className="page home-page">
      <header className="home-greeting">
        <span
          className="home-avatar"
          style={{ '--avatar-color': profile?.color || 'var(--primary)' }}
          aria-hidden="true"
        >
          {profile?.avatar || '👋'}
        </span>
        <div>
          <p className="muted small home-eyebrow">Välkommen hem</p>
          <h1 className="page-title">Hej {profile?.display_name || 'där'}!</h1>
        </div>
      </header>

      <section className="card today-card" aria-labelledby="today-heading">
        <div className="section-heading-row">
          <h2 id="today-heading" className="home-section-heading">
            Idag
          </h2>
          <span aria-hidden="true">☀️</span>
        </div>

        {todayLoading && <p className="muted small today-message">Laddar dagens planer…</p>}
        {todayError && <p className="error today-message">{todayError}</p>}
        {!todayLoading && !todayError && todayEvents.length === 0 && todayMeals.length === 0 && (
          <p className="muted small today-message">Inget planerat idag – njut av dagen.</p>
        )}

        {!todayLoading && !todayError && (todayEvents.length > 0 || todayMeals.length > 0) && (
          <div className="today-columns">
            <div>
              <h3 className="today-subheading">Kalender</h3>
              {todayEvents.length === 0 ? (
                <p className="muted small today-empty">Inga händelser.</p>
              ) : (
                <ul className="today-list">
                  {todayEvents.map((event) => (
                    <li key={event.id}>
                      <span
                        className="today-dot"
                        style={{ '--event-color': event.color || 'var(--primary)' }}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{formatEventTime(event)}</strong> {event.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="today-subheading">Måltider</h3>
              {todayMeals.length === 0 ? (
                <p className="muted small today-empty">Inga måltider.</p>
              ) : (
                <ul className="today-list">
                  {todayMeals.map((meal) => (
                    <li key={meal.id}>
                      <span aria-hidden="true">🍴</span>
                      <span>
                        <strong>{MEAL_LABELS[meal.meal_type] || meal.meal_type}:</strong>{' '}
                        {meal.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <ActivityFeed />

      <section aria-labelledby="quick-links-heading">
        <h2 id="quick-links-heading" className="home-section-heading">
          Snabblänkar
        </h2>
        <div className="dashboard-grid home-links">
          {QUICK_LINKS.map((item) => (
            <Link to={item.to} className="card dash-card home-link" key={item.to}>
              <span className="dash-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="dash-label">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-utilities" aria-label="Hushåll och notiser">
        <NotificationButton />

        {household && (
          <div className="card invite-card compact-invite-card">
            <div>
              <p className="household-name">{household.name}</p>
              <p className="muted small invite-help">Bjud in en familjemedlem med koden</p>
            </div>
            <p className="invite-code compact-invite-code">{household.invite_code}</p>
          </div>
        )}
      </section>
    </div>
  )
}
