import { useMemo, useState } from 'react'
import { useCollection } from '../lib/useCollection'
import './Calendar.css'

const CATEGORY_OPTIONS = [
  { name: 'Familj', color: '#4f46e5' },
  { name: 'Skola', color: '#0ea5e9' },
  { name: 'Arbete', color: '#dc2626' },
  { name: 'Fritid', color: '#16a34a' },
  { name: 'Övrigt', color: '#6b7280' },
]

function toLocalInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function getEasterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function getSwedishHolidays(year) {
  const holidays = new Map([
    [`${year}-01-01`, 'Nyårsdagen'],
    [`${year}-01-06`, 'Trettondedag jul'],
    [`${year}-05-01`, 'Första maj'],
    [`${year}-06-06`, 'Nationaldagen'],
    [`${year}-12-24`, 'Julafton'],
    [`${year}-12-25`, 'Juldagen'],
    [`${year}-12-26`, 'Annandag jul'],
    [`${year}-12-31`, 'Nyårsafton'],
  ])
  const easter = getEasterSunday(year)
  const easterHolidays = [
    [-2, 'Långfredagen'],
    [0, 'Påskdagen'],
    [1, 'Annandag påsk'],
    [39, 'Kristi himmelsfärdsdag'],
    [49, 'Pingstdagen'],
  ]
  easterHolidays.forEach(([offset, name]) => {
    holidays.set(toLocalInputDate(addDays(easter, offset)), name)
  })

  const june19 = new Date(year, 5, 19)
  const daysUntilFriday = (5 - june19.getDay() + 7) % 7
  holidays.set(toLocalInputDate(addDays(june19, daysUntilFriday)), 'Midsommarafton')
  return holidays
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

function EventItems({ events, remove }) {
  return (
    <ul className="list">
      {events.map((event) => (
        <li key={event.id} className="list-item cal-event">
          <span
            className="cal-color-dot"
            style={{ backgroundColor: event.color || 'var(--primary)' }}
            aria-hidden="true"
          />
          <div className="cal-event-body">
            <span className="cal-event-time">
              {formatTime(event)}
              {event.category ? ` · ${event.category}` : ''}
            </span>
            <span className="cal-event-title">{event.title}</span>
            {event.description && <span className="muted small">{event.description}</span>}
          </div>
          <button
            type="button"
            className="btn icon"
            onClick={() => remove(event.id)}
            aria-label={`Ta bort ${event.title}`}
          >
            🗑️
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function Calendar() {
  const { items, loading, error, add, remove } = useCollection('calendar_events', 'start_at')
  const {
    items: contacts,
    loading: contactsLoading,
    error: contactsError,
  } = useCollection('contacts')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(toLocalInputDate(new Date()))
  const [time, setTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].name)
  const [color, setColor] = useState(CATEGORY_OPTIONS[0].color)
  const [view, setView] = useState('month')
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const [selectedDate, setSelectedDate] = useState(toLocalInputDate(new Date()))

  const eventsByDate = useMemo(
    () =>
      items.reduce((groups, event) => {
        const dateKey = toLocalInputDate(new Date(event.start_at))
        if (!groups[dateKey]) groups[dateKey] = []
        groups[dateKey].push(event)
        return groups
      }, {}),
    [items],
  )

  const birthdaysByMonthDay = useMemo(
    () =>
      contacts.reduce((groups, contact) => {
        if (!contact.birthday) return groups
        const monthDay = contact.birthday.slice(5)
        if (!groups[monthDay]) groups[monthDay] = []
        groups[monthDay].push(contact)
        return groups
      }, {}),
    [contacts],
  )

  const monthCells = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cellCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7
    return Array.from({ length: cellCount }, (_, index) => {
      const cellDate = new Date(year, month, index - firstDayOffset + 1)
      return {
        date: cellDate,
        dateKey: toLocalInputDate(cellDate),
        isCurrentMonth: cellDate.getMonth() === month,
      }
    })
  }, [visibleMonth])

  const holidays = useMemo(() => {
    const years = new Set(monthCells.map(({ date: cellDate }) => cellDate.getFullYear()))
    const combined = new Map()
    years.forEach((year) => {
      getSwedishHolidays(year).forEach((name, dateKey) => combined.set(dateKey, name))
    })
    return combined
  }, [monthCells])

  const todayKey = toLocalInputDate(new Date())
  const selectedEvents = [...(eventsByDate[selectedDate] ?? [])].sort(
    (a, b) => new Date(a.start_at) - new Date(b.start_at),
  )
  const selectedBirthdays = birthdaysByMonthDay[selectedDate.slice(5)] ?? []
  const selectedHoliday = holidays.get(selectedDate)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const upcoming = [...items]
    .filter((event) => {
      const reference = event.end_at ? new Date(event.end_at) : new Date(event.start_at)
      return reference >= todayStart
    })
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  const agendaGroups = upcoming.reduce((groups, event) => {
    const dateKey = toLocalInputDate(new Date(event.start_at))
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(event)
    return groups
  }, {})
  const agendaDayKeys = Object.keys(agendaGroups).sort()

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
      category,
      color,
    })
    setTitle('')
    setTime('')
    setAllDay(false)
    setDescription('')
  }

  const handleCategoryChange = (event) => {
    const nextCategory = event.target.value
    const option = CATEGORY_OPTIONS.find(({ name }) => name === nextCategory)
    setCategory(nextCategory)
    if (option) setColor(option.color)
  }

  const changeMonth = (offset) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )
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
        <div className="cal-row">
          <label>
            Kategori
            <select value={category} onChange={handleCategoryChange}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Färg
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Händelsens färg"
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

      {(error || contactsError) && <p className="error">{error || contactsError}</p>}

      <div className="cal-view-toggle" aria-label="Kalendervy">
        <button
          type="button"
          className={`btn ${view === 'month' ? 'primary' : 'ghost'}`}
          onClick={() => setView('month')}
          aria-pressed={view === 'month'}
        >
          Månad
        </button>
        <button
          type="button"
          className={`btn ${view === 'list' ? 'primary' : 'ghost'}`}
          onClick={() => setView('list')}
          aria-pressed={view === 'list'}
        >
          Lista
        </button>
      </div>

      {view === 'month' ? (
        <>
          <section className="card cal-month">
            <div className="cal-month-header">
              <button
                type="button"
                className="btn icon"
                onClick={() => changeMonth(-1)}
                aria-label="Föregående månad"
              >
                ‹
              </button>
              <h2>
                {visibleMonth.toLocaleDateString('sv-SE', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <button
                type="button"
                className="btn icon"
                onClick={() => changeMonth(1)}
                aria-label="Nästa månad"
              >
                ›
              </button>
            </div>
            <div className="cal-weekdays" aria-hidden="true">
              {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="cal-grid">
              {monthCells.map(({ date: cellDate, dateKey, isCurrentMonth }) => {
                const dayEvents = eventsByDate[dateKey] ?? []
                const dayBirthdays = birthdaysByMonthDay[dateKey.slice(5)] ?? []
                const holiday = holidays.get(dateKey)
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={[
                      'cal-day',
                      isCurrentMonth ? '' : 'outside',
                      dateKey === todayKey ? 'today' : '',
                      dateKey === selectedDate ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedDate(dateKey)}
                    aria-label={formatDayHeading(dateKey)}
                    aria-pressed={dateKey === selectedDate}
                  >
                    <span className="cal-day-number">{cellDate.getDate()}</span>
                    <span className="cal-day-dots" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((dayEvent) => (
                        <span
                          key={dayEvent.id}
                          className="cal-color-dot"
                          style={{ backgroundColor: dayEvent.color || 'var(--primary)' }}
                        />
                      ))}
                      {dayBirthdays.length > 0 && <span className="cal-birthday-dot">🎂</span>}
                    </span>
                    {holiday && <span className="cal-holiday-label">{holiday}</span>}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="cal-selected-day">
            <h2 className="cal-day-heading">{formatDayHeading(selectedDate)}</h2>
            {selectedHoliday && <p className="cal-special-day">🇸🇪 {selectedHoliday}</p>}
            {selectedBirthdays.map((contact) => (
              <p key={contact.id} className="cal-special-day">
                🎂 {contact.name} fyller år
              </p>
            ))}
            {selectedEvents.length > 0 && <EventItems events={selectedEvents} remove={remove} />}
            {selectedEvents.length === 0 &&
              selectedBirthdays.length === 0 &&
              !selectedHoliday && <p className="muted">Inget planerat den här dagen.</p>}
          </section>
        </>
      ) : (
        <>
          {loading && <p className="muted">Laddar…</p>}
          {!loading && agendaDayKeys.length === 0 && (
            <p className="muted">Inga kommande händelser.</p>
          )}
          {agendaDayKeys.map((dayKey) => (
            <div key={dayKey} className="cal-group">
              <h2 className="cal-day-heading">{formatDayHeading(dayKey)}</h2>
              <EventItems events={agendaGroups[dayKey]} remove={remove} />
            </div>
          ))}
        </>
      )}

      {view === 'month' && (loading || contactsLoading) && (
        <p className="muted">Laddar kalendern…</p>
      )}
    </div>
  )
}
