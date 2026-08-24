import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ListTodo,
  CalendarDays,
  UtensilsCrossed,
  Wallet,
  BookOpen,
  Folder,
  Sun,
  Utensils,
  CloudSun,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import ActivityFeed from '../components/ActivityFeed'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import NotificationButton from '../components/NotificationButton'
import Spinner from '../components/Spinner'
import './Home.css'

const QUICK_LINKS = [
  { to: '/listor', label: 'Listor', icon: ListTodo },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/maltider', label: 'Måltider', icon: UtensilsCrossed },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/recept', label: 'Recept', icon: BookOpen },
  { to: '/dokument', label: 'Dokument', icon: Folder },
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

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 5) return 'God kväll'
  if (hour < 10) return 'God morgon'
  if (hour < 18) return 'God dag'
  return 'God kväll'
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

  const displayName = profile?.display_name || 'där'

  return (
    <div className="page home-page">
      <header className="home-greeting">
        <Avatar profile={profile} size={58} className="home-avatar" />
        <div className="home-greeting-copy">
          <p className="muted small home-eyebrow">Välkommen till familjens samlingsplats</p>
          <h1 className="page-title">
            {getGreeting()}, {displayName}!
          </h1>
        </div>
      </header>

      <section className="card today-card" aria-labelledby="today-heading">
        <div className="section-heading-row">
          <div>
            <p className="muted small home-section-eyebrow">Din dag i korthet</p>
            <h2 id="today-heading" className="home-section-heading">
              Idag
            </h2>
          </div>
          <span className="today-heading-icon" aria-hidden="true">
            <Sun size={22} strokeWidth={1.75} />
          </span>
        </div>

        {todayLoading && <Spinner label="Laddar dagens planer…" />}
        {todayError && <p className="error today-message">{todayError}</p>}
        {!todayLoading && !todayError && todayEvents.length === 0 && todayMeals.length === 0 && (
          <div className="today-empty-state">
            <EmptyState
              icon={CloudSun}
              title="Inget planerat idag"
              description="Njut av en lugn dag tillsammans."
            />
          </div>
        )}

        {!todayLoading && !todayError && (todayEvents.length > 0 || todayMeals.length > 0) && (
          <div className="today-columns">
            <div className="today-group">
              <h3 className="today-subheading">
                <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
                Kalender
              </h3>
              {todayEvents.length === 0 ? (
                <p className="muted small today-placeholder">Inga händelser idag.</p>
              ) : (
                <ul className="today-list">
                  {todayEvents.map((event) => (
                    <li key={event.id}>
                      <span
                        className="today-dot"
                        style={{ '--event-color': event.color || 'var(--primary)' }}
                        aria-hidden="true"
                      />
                      <span className="today-item-copy">
                        <span className="today-event-time">{formatEventTime(event)}</span>
                        <strong className="today-item-title">{event.title}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="today-group">
              <h3 className="today-subheading">
                <UtensilsCrossed size={15} strokeWidth={2} aria-hidden="true" />
                Måltider
              </h3>
              {todayMeals.length === 0 ? (
                <p className="muted small today-placeholder">Inga måltider planerade.</p>
              ) : (
                <ul className="today-list">
                  {todayMeals.map((meal) => (
                    <li key={meal.id}>
                      <span className="today-meal-icon" aria-hidden="true">
                        <Utensils size={15} strokeWidth={2} />
                      </span>
                      <span className="today-item-copy">
                        <span className="today-event-time">
                          {MEAL_LABELS[meal.meal_type] || meal.meal_type}
                        </span>
                        <strong className="today-item-title">{meal.title}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="home-wall">
        <ActivityFeed />
      </div>

      <section className="home-links-section" aria-labelledby="quick-links-heading">
        <div className="home-section-header">
          <h2 id="quick-links-heading" className="home-section-heading">
            Snabblänkar
          </h2>
          <span className="muted small">Allt på ett tryck</span>
        </div>
        <div className="dashboard-grid home-links">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link to={item.to} className="card dash-card home-link" key={item.to}>
                <span className="dash-icon home-link-icon" aria-hidden="true">
                  <Icon size={24} strokeWidth={1.75} />
                </span>
                <span className="dash-label">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="home-utilities" aria-label="Hushåll och notiser">
        {household && (
          <div className="card invite-card compact-invite-card">
            <div>
              <p className="household-name">{household.name}</p>
              <p className="muted small invite-help">Bjud in en familjemedlem med koden</p>
            </div>
            <p className="invite-code compact-invite-code">{household.invite_code}</p>
          </div>
        )}

        <div className="home-notifications">
          <NotificationButton />
        </div>
      </section>
    </div>
  )
}
