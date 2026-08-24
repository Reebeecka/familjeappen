import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useCollection } from '../lib/useCollection'
import './MealPlanner.css'

const MEAL_TYPES = [
  { value: 'frukost', label: 'Frukost' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'middag', label: 'Middag' },
]

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayHeading(date) {
  const text = date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function MealPlanner() {
  const { items, loading, error, add, remove } = useCollection('meals', 'meal_date')
  const [drafts, setDrafts] = useState({})
  const [submittingKey, setSubmittingKey] = useState(null)
  const [formErrors, setFormErrors] = useState({})

  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    return { key: toDateKey(date), heading: formatDayHeading(date) }
  })

  const setDraft = (fieldKey, value) => {
    setDrafts((current) => ({ ...current, [fieldKey]: value }))
  }

  const handleAdd = async (dateKey, mealType) => {
    if (submittingKey) return
    const fieldKey = `${dateKey}-${mealType}`
    const trimmed = (drafts[fieldKey] ?? '').trim()
    if (!trimmed) {
      setFormErrors((current) => ({ ...current, [fieldKey]: 'Ange en måltid.' }))
      return
    }
    setSubmittingKey(fieldKey)
    setFormErrors((current) => ({ ...current, [fieldKey]: '' }))
    const wasAdded = await add({ meal_date: dateKey, meal_type: mealType, title: trimmed })
    if (wasAdded) {
      setDraft(fieldKey, '')
    } else {
      setFormErrors((current) => ({
        ...current,
        [fieldKey]: 'Måltiden kunde inte sparas. Försök igen.',
      }))
    }
    setSubmittingKey(null)
  }

  const handleRemove = (meal) => {
    if (!window.confirm(`Vill du ta bort måltiden "${meal.title}"? Detta går inte att ångra.`))
      return
    remove(meal.id)
  }

  return (
    <div className="page">
      <h1 className="page-title">Måltider 🍽️</h1>

      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {!loading && items.length === 0 && (
        <EmptyState
          icon={UtensilsCrossed}
          title="Inga måltider planerade"
          description="Lägg till en måltid i veckoplaneringen nedan."
        />
      )}

      {days.map((day) => (
        <div key={day.key} className="card meal-day">
          <h2 className="meal-day-heading">{day.heading}</h2>
          {MEAL_TYPES.map((type) => {
            const meals = items.filter(
              (meal) => meal.meal_date === day.key && meal.meal_type === type.value,
            )
            const fieldKey = `${day.key}-${type.value}`
            return (
              <div key={type.value} className="meal-slot">
                <span className="meal-type">{type.label}</span>
                <ul className="list">
                  {meals.map((meal) => (
                    <li key={meal.id} className="list-item">
                      <span>{meal.title}</span>
                      <button
                        type="button"
                        className="btn icon"
                        onClick={() => handleRemove(meal)}
                        aria-label={`Ta bort måltiden ${meal.title}`}
                      >
                        🗑️
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="add-row"
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleAdd(day.key, type.value)
                  }}
                >
                  <input
                    type="text"
                    value={drafts[fieldKey] ?? ''}
                    onChange={(e) => setDraft(fieldKey, e.target.value)}
                    placeholder={`Lägg till ${type.label.toLowerCase()}…`}
                    aria-label={`Lägg till ${type.label.toLowerCase()} för ${day.heading}`}
                  />
                  <button
                    type="submit"
                    className="btn primary"
                    aria-label={`Lägg till ${type.label.toLowerCase()} för ${day.heading}`}
                    disabled={Boolean(submittingKey)}
                  >
                    {submittingKey === fieldKey ? 'Sparar…' : '+'}
                  </button>
                </form>
                {formErrors[fieldKey] && <p className="error">{formErrors[fieldKey]}</p>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
