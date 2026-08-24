import { useState } from 'react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useCollection } from '../lib/useCollection'
import './RecurringTasks.css'

const WEEKDAYS = [
  { value: 1, label: 'måndagar' },
  { value: 2, label: 'tisdagar' },
  { value: 3, label: 'onsdagar' },
  { value: 4, label: 'torsdagar' },
  { value: 5, label: 'fredagar' },
  { value: 6, label: 'lördagar' },
  { value: 0, label: 'söndagar' },
]

function describeCadence(task) {
  if (task.cadence === 'daily') return 'Varje dag'
  if (task.cadence === 'weekly') {
    const day = WEEKDAYS.find((w) => w.value === Number(task.weekday))
    return day ? `Varje vecka på ${day.label}` : 'Varje vecka'
  }
  if (task.cadence === 'monthly') {
    return task.day_of_month
      ? `Den ${Number(task.day_of_month)}:e varje månad`
      : 'Varje månad'
  }
  return ''
}

export default function RecurringTasks() {
  const { items, loading, error, add, update, remove } = useCollection('recurring_tasks')
  const [title, setTitle] = useState('')
  const [cadence, setCadence] = useState('daily')
  const [weekday, setWeekday] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleAdd = async (event) => {
    event.preventDefault()
    if (submitting) return
    const trimmed = title.trim()
    if (!trimmed) {
      setSubmitError('Ange en titel för uppgiften.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    const wasAdded = await add({
      title: trimmed,
      cadence,
      weekday: cadence === 'weekly' ? Number(weekday) : null,
      day_of_month: cadence === 'monthly' ? Number(dayOfMonth) : null,
      active: true,
    })
    if (wasAdded) {
      setTitle('')
      setCadence('daily')
      setWeekday(1)
      setDayOfMonth(1)
    } else {
      setSubmitError('Uppgiften kunde inte sparas. Försök igen.')
    }
    setSubmitting(false)
  }

  const handleRemove = (task) => {
    if (
      !window.confirm(
        `Vill du ta bort den återkommande uppgiften "${task.title}"? Detta går inte att ångra.`,
      )
    )
      return
    remove(task.id)
  }

  return (
    <div className="page">
      <h1 className="page-title">Återkommande 🔁</h1>

      <form onSubmit={handleAdd} className="form card">
        <label>
          Titel
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ny återkommande uppgift…"
          />
        </label>
        <label>
          Intervall
          <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
            <option value="daily">Varje dag</option>
            <option value="weekly">Varje vecka</option>
            <option value="monthly">Varje månad</option>
          </select>
        </label>
        {cadence === 'weekly' && (
          <label>
            Veckodag
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label.charAt(0).toUpperCase() + day.label.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}
        {cadence === 'monthly' && (
          <label>
            Dag i månaden
            <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Den {day}:e
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Sparar…' : 'Lägg till'}
        </button>
        {submitError && <p className="error">{submitError}</p>}
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {!loading && items.length === 0 && (
        <EmptyState
          icon="🔁"
          title="Inga återkommande uppgifter"
          description="Lägg till en uppgift som ska upprepas automatiskt."
        />
      )}

      <ul className="list">
        {items.map((task) => (
          <li key={task.id} className={task.active ? 'list-item' : 'list-item done'}>
            <div className="recur-body">
              <span className="recur-title">{task.title}</span>
              <span className="muted small">{describeCadence(task)}</span>
            </div>
            <div className="recur-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => update(task.id, { active: !task.active })}
              >
                {task.active ? 'Pausa' : 'Aktivera'}
              </button>
              <button
                type="button"
                className="btn icon"
                onClick={() => handleRemove(task)}
                aria-label={`Ta bort den återkommande uppgiften ${task.title}`}
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
