import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Sun, Trophy, Utensils, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import ActivityFeed from '../components/ActivityFeed'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import { useRugbyMatches } from '../lib/useRugbyMatches'
import { formatMatchWhen, matchTitle } from '../lib/rugbyClubs'
import './Home.css'

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
  const [todayEvents, setTodayEvents] = useState([])
  const [todayMeals, setTodayMeals] = useState([])
  const [todayLoading, setTodayLoading] = useState(true)
  const [todayError, setTodayError] = useState(null)
  const rugbyWeek = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 8)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [])
  const { items: weekRugby, error: rugbyError } = useRugbyMatches(rugbyWeek.from, rugbyWeek.to)

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
      const [eventsResult, mealsResult] = await Promise.all([
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
  const hasToday = todayEvents.length > 0 || todayMeals.length > 0

  return (
    <div className="page home-page">
      <header className="home-greeting">
        <Avatar profile={profile} size={44} className="home-avatar" />
        <h1 className="page-title">
          {getGreeting()}, {displayName}
        </h1>
      </header>

      <section className="card today-card" aria-labelledby="today-heading">
        <div className="today-header">
          <h2 id="today-heading" className="home-section-heading">
            Idag
          </h2>
          <Sun size={18} strokeWidth={1.75} aria-hidden="true" />
        </div>

        {todayLoading && <Spinner label="Laddar…" />}
        {todayError && <p className="error today-message">{todayError}</p>}
        {!todayLoading && !todayError && !hasToday && (
          <p className="muted small today-placeholder">Inget planerat idag.</p>
        )}

        {!todayLoading && !todayError && hasToday && (
          <ul className="today-list">
            {todayEvents.map((event) => (
              <li key={event.id}>
                <Link to="/kalender" className="today-row">
                  <span
                    className="today-dot"
                    style={{ '--event-color': event.color || 'var(--primary)' }}
                    aria-hidden="true"
                  />
                  <span className="today-item-copy">
                    <span className="today-event-time">
                      <CalendarDays size={12} strokeWidth={2} aria-hidden="true" />
                      {formatEventTime(event)}
                    </span>
                    <strong className="today-item-title">{event.title}</strong>
                  </span>
                </Link>
              </li>
            ))}
            {todayMeals.map((meal) => (
              <li key={meal.id}>
                <Link to="/maltider" className="today-row">
                  <span className="today-meal-icon" aria-hidden="true">
                    <Utensils size={14} strokeWidth={2} />
                  </span>
                  <span className="today-item-copy">
                    <span className="today-event-time">
                      <UtensilsCrossed size={12} strokeWidth={2} aria-hidden="true" />
                      {MEAL_LABELS[meal.meal_type] || meal.meal_type}
                    </span>
                    <strong className="today-item-title">{meal.title}</strong>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!rugbyError && weekRugby.length > 0 && (
        <section className="card today-card" aria-labelledby="rugby-heading">
          <div className="today-header">
            <h2 id="rugby-heading" className="home-section-heading">
              Rugby i veckan
            </h2>
            <Trophy size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
          <ul className="today-list">
            {weekRugby.map((match) => (
              <li key={match.api_id}>
                <Link to="/rugby" className="today-row">
                  <span className="today-meal-icon" aria-hidden="true">
                    <Trophy size={14} strokeWidth={2} />
                  </span>
                  <span className="today-item-copy">
                    <span className="today-event-time">{formatMatchWhen(match)}</span>
                    <strong className="today-item-title">{matchTitle(match)}</strong>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ActivityFeed />
    </div>
  )
}
