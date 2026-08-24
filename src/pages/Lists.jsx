import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useCollection } from '../lib/useCollection'
import './Lists.css'

const TYPE_OPTIONS = {
  todo: { label: 'Att göra', icon: '✅' },
  shopping: { label: 'Inköp', icon: '🛒' },
}

export default function Lists() {
  const {
    items: lists,
    loading: listsLoading,
    error: listsError,
    add,
    remove,
  } = useCollection('lists')
  const {
    items: listItems,
    loading: itemsLoading,
    error: itemsError,
  } = useCollection('list_items')
  const [name, setName] = useState('')
  const [type, setType] = useState('todo')
  const [submitting, setSubmitting] = useState(false)

  const remainingByList = useMemo(
    () =>
      listItems.reduce((counts, item) => {
        if (!item.done) counts.set(item.list_id, (counts.get(item.list_id) ?? 0) + 1)
        return counts
      }, new Map()),
    [listItems],
  )

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || submitting) return

    setSubmitting(true)
    const wasAdded = await add({
      name: trimmedName,
      type,
      icon: TYPE_OPTIONS[type].icon,
    })
    setSubmitting(false)

    if (wasAdded) setName('')
  }

  const loading = listsLoading || itemsLoading
  const error = listsError || itemsError

  return (
    <div className="page">
      <h1 className="page-title">Listor 📋</h1>

      <form onSubmit={handleAdd} className="form card lists-form" aria-busy={submitting}>
        <label>
          Listnamn
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ny lista…"
          />
        </label>
        <label>
          Typ
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(TYPE_OPTIONS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.icon} {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn primary" disabled={submitting || !name.trim()}>
          {submitting ? 'Skapar…' : 'Skapa lista'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {!loading && lists.length === 0 && (
        <EmptyState
          icon="🗒️"
          title="Inga listor än"
          description="Skapa familjens första lista ovan."
        />
      )}

      <div className="lists-grid">
        {lists.map((list) => {
          const typeOption = TYPE_OPTIONS[list.type] ?? TYPE_OPTIONS.todo
          const remaining = remainingByList.get(list.id) ?? 0

          return (
            <article key={list.id} className="card lists-card">
              <Link to={`/listor/${list.id}`} className="lists-card-link">
                <span className="lists-card-icon" aria-hidden="true">
                  {list.icon || typeOption.icon}
                </span>
                <span className="lists-card-content">
                  <span className="lists-card-name">{list.name}</span>
                  <span className={`lists-remaining ${remaining === 0 ? 'is-complete' : ''}`}>
                    <strong>{remaining}</strong>
                    <span>{remaining === 1 ? 'punkt kvar' : 'punkter kvar'}</span>
                  </span>
                </span>
              </Link>
              <button
                type="button"
                className="btn icon lists-delete"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Vill du ta bort listan "${list.name}"? Detta går inte att ångra.`,
                    )
                  )
                    return
                  remove(list.id)
                }}
                aria-label={`Ta bort listan ${list.name}`}
              >
                🗑️
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
