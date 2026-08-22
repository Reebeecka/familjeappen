import { useState } from 'react'
import { useCollection } from '../lib/useCollection'
import './Calendar.css'

function toLocalInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayHeading(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  const text = date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatTime(event) {
  if (event.all_day) return 'Heldag'
  const start = new Date(event.start_at)
  const startText = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  if (!event.end_at) return startText
  const end = new Date(event.end_at)
  const endText = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return `${startText}–${endText}`
}

export default function Calendar() {
  const { items, loading, error, add, remove } = useCollection('calendar_events', 'start_at')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(toLocalInputDate(new Date()))
  const [time, setTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [description, setDescription] = useState('')

  const now = new Date()
  const upcoming = items.filter((event) => {
    const reference = event.end_at ? new Date(event.end_at) : new Date(event.start_at)
    return reference >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })

  const groups = upcoming.reduce((acc, event) => {
    const key = new Date(event.start_at).toLocaleDateString('sv-SE')
    const isoKey = toLocalInputDate(new Date(event.start_at))
    if (!acc[isoKey]) acc[isoKey] = { label: key, events: [] }
    acc[isoKey].events.push(event)
    return acc
  }, {})
  const dayKeys = Object.keys(groups).sort()

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !date) return
    const startAt = allDay || !time ? `${date}T00:00:00` : `${date}T${time}:00`
    await add({
      title: trimmed,
      description: description.trim() || null,
      start_at: new Date(startAt).toISOString(),
      all_day: allDay,
    })
    setTitle('')
    setTime('')
    setAllDay(false)
    setDescription('')
  }

  return (
    <div className="page">
      <h1 className="page-title">Kalender 📅</h1>

      <form onSubmit={handleAdd} className="form card">
        <label>
          Titel
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ny händelse…"
          />
        </label>
        <div className="cal-row">
          <label>
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Tid
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={allDay}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          <span>Heldag</span>
        </label>
        <label>
          Beskrivning (valfritt)
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detaljer…"
          />
        </label>
        <button type="submit" className="btn primary">
          Lägg till
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && dayKeys.length === 0 && (
        <p className="muted">Inga kommande händelser.</p>
      )}

      {dayKeys.map((dayKey) => (
        <div key={dayKey} className="cal-group">
          <h2 className="cal-day-heading">{formatDayHeading(dayKey)}</h2>
          <ul className="list">
            {groups[dayKey].events.map((event) => (
              <li key={event.id} className="list-item cal-event">
                <div className="cal-event-body">
                  <span className="cal-event-time">{formatTime(event)}</span>
                  <span className="cal-event-title">{event.title}</span>
                  {event.description && (
                    <span className="muted small">{event.description}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn icon"
                  onClick={() => remove(event.id)}
                  aria-label="Ta bort"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
