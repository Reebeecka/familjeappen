import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ListTodo, Sunrise, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import './MyDay.css'

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

function formatToday(date) {
  const text = date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatEventTime(event) {
  if (event.all_day) return 'Heldag'
  return new Date(event.start_at).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isMissingDueDate(error) {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    (message.includes('due_date') &&
      (message.includes('does not exist') || message.includes('could not find')))
  )
}

async function loadAssignedItems(householdId, userId) {
  const queryWithDueDate = await supabase
    .from('list_items')
    .select('id, title, list_id, due_date, created_at')
    .eq('household_id', householdId)
    .eq('assigned_to', userId)
    .eq('done', false)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (!isMissingDueDate(queryWithDueDate.error)) return queryWithDueDate

  return supabase
    .from('list_items')
    .select('id, title, list_id, created_at')
    .eq('household_id', householdId)
    .eq('assigned_to', userId)
    .eq('done', false)
    .order('created_at', { ascending: true })
}

function getDueState(item, todayKey) {
  if (!item.due_date) return null
  if (item.due_date < todayKey) return { label: 'Försenad', className: 'overdue' }
  if (item.due_date === todayKey) return { label: 'Idag', className: 'today' }
  return null
}

function sortAssignedItems(items, todayKey) {
  const rank = (item) => {
    if (!item.due_date) return 3
    if (item.due_date < todayKey) return 0
    if (item.due_date === todayKey) return 1
    return 2
  }

  return [...items].sort((first, second) => {
    const rankDifference = rank(first) - rank(second)
    if (rankDifference !== 0) return rankDifference
    return (first.due_date ?? '').localeCompare(second.due_date ?? '')
  })
}

export default function MyDay() {
  const { user, profile, householdId } = useAuth()
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = new Date()
  const todayKey = toDateKey(today)

  useEffect(() => {
    if (!user?.id || !householdId || !supabase) return

    let active = true

    const loadDay = async () => {
      setLoading(true)
      setError('')

      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const nextDay = new Date(dayStart)
      nextDay.setDate(nextDay.getDate() + 1)
      const dateKey = toDateKey(dayStart)

      const [taskResponse, eventResponse, mealResponse] = await Promise.all([
        loadAssignedItems(householdId, user.id),
        supabase
          .from('calendar_events')
          .select('id, title, start_at, all_day, category')
          .eq('household_id', householdId)
          .gte('start_at', dayStart.toISOString())
          .lt('start_at', nextDay.toISOString())
          .order('start_at', { ascending: true }),
        supabase
          .from('meals')
          .select('id, title, meal_type, meal_date')
          .eq('household_id', householdId)
          .eq('meal_date', dateKey)
          .order('meal_type', { ascending: true }),
      ])

      if (!active) return

      setTasks(sortAssignedItems(taskResponse.data ?? [], dateKey))
      setEvents(eventResponse.data ?? [])
      setMeals(mealResponse.data ?? [])
      setError(
        [taskResponse, eventResponse, mealResponse].some((response) => response.error)
          ? 'Delar av dagen kunde inte hämtas just nu.'
          : '',
      )
      setLoading(false)
    }

    loadDay()

    return () => {
      active = false
    }
  }, [householdId, user?.id])

  const isEmpty = tasks.length === 0 && events.length === 0 && meals.length === 0

  return (
    <div className="page">
      <header className="my-day-header">
        <div>
          <h1 className="page-title">Min dag</h1>
          <p className="muted">
            {formatToday(today)}
            {profile?.display_name ? ` · ${profile.display_name}` : ''}
          </p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {loading && <Spinner label="Hämtar din dag…" />}

      {!loading && isEmpty && (
        <EmptyState
          icon={Sunrise}
          title="Inget planerat för idag"
          description="Du har en lugn dag framför dig."
        />
      )}

      {!loading && !isEmpty && (
        <div className="my-day-sections">
          <section className="card my-day-section">
            <div className="my-day-section-heading">
              <h2>
                <ListTodo size={18} strokeWidth={1.75} aria-hidden="true" /> Mina listpunkter
              </h2>
              <span className="my-day-count">{tasks.length}</span>
            </div>
            {tasks.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="Inga listpunkter"
                description="Du har inga öppna listpunkter tilldelade till dig."
              />
            ) : (
              <ul className="list">
                {tasks.map((item) => {
                  const dueState = getDueState(item, todayKey)
                  return (
                    <li key={item.id}>
                      <Link className="my-day-row" to={`/listor/${item.list_id}`}>
                        <span>{item.title}</span>
                        {dueState && (
                          <span className={`my-day-due ${dueState.className}`}>
                            {dueState.label}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card my-day-section">
            <div className="my-day-section-heading">
              <h2>
                <CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" /> Kalender
              </h2>
              <span className="my-day-count">{events.length}</span>
            </div>
            {events.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Inga kalenderhändelser"
                description="Det finns inga kalenderhändelser idag."
              />
            ) : (
              <ul className="list">
                {events.map((event) => (
                  <li key={event.id}>
                    <Link className="my-day-row" to="/kalender">
                      <span>
                        <strong>{event.title}</strong>
                        {event.category && <small className="muted">{event.category}</small>}
                      </span>
                      <span className="my-day-time">{formatEventTime(event)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card my-day-section">
            <div className="my-day-section-heading">
              <h2>
                <UtensilsCrossed size={18} strokeWidth={1.75} aria-hidden="true" /> Måltider
              </h2>
              <span className="my-day-count">{meals.length}</span>
            </div>
            {meals.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="Inga måltider planerade"
                description="Det finns inga måltider planerade idag."
              />
            ) : (
              <ul className="list">
                {meals.map((meal) => (
                  <li key={meal.id}>
                    <Link className="my-day-row" to="/maltider">
                      <span>{meal.title}</span>
                      <span className="my-day-meal-type">
                        {MEAL_LABELS[meal.meal_type] ?? meal.meal_type}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
