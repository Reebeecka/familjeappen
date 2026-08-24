import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Trash2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useCollection } from '../lib/useCollection'
import {
  DEFAULT_LIST_ICON,
  LIST_ICONS,
  LIST_ICON_KEYS,
  ListIcon,
} from '../lib/listIcons'
import './Lists.css'

const TYPE_OPTIONS = {
  todo: { label: 'Att göra' },
  shopping: { label: 'Inköp' },
  simple: { label: 'Annat' },
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
  const [icon, setIcon] = useState(DEFAULT_LIST_ICON.todo)
  const [iconTouched, setIconTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const remainingByList = useMemo(
    () =>
      listItems.reduce((counts, item) => {
        if (!item.done) counts.set(item.list_id, (counts.get(item.list_id) ?? 0) + 1)
        return counts
      }, new Map()),
    [listItems],
  )

  const handleTypeChange = (nextType) => {
    setType(nextType)
    if (!iconTouched) setIcon(DEFAULT_LIST_ICON[nextType] ?? 'note')
  }

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || submitting) return

    setSubmitting(true)
    const wasAdded = await add({ name: trimmedName, type, icon })
    setSubmitting(false)

    if (wasAdded) {
      setName('')
      setIconTouched(false)
      setIcon(DEFAULT_LIST_ICON[type] ?? 'note')
    }
  }

  const loading = listsLoading || itemsLoading
  const error = listsError || itemsError

  return (
    <div className="page">
      <h1 className="page-title">Listor</h1>

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
          <select value={type} onChange={(event) => handleTypeChange(event.target.value)}>
            {Object.entries(TYPE_OPTIONS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="lists-icon-picker">
          <legend>Ikon</legend>
          <div className="lists-icon-options">
            {LIST_ICON_KEYS.map((key) => {
              const OptionIcon = LIST_ICONS[key]
              const selected = key === icon
              return (
                <button
                  key={key}
                  type="button"
                  className={selected ? 'lists-icon-option selected' : 'lists-icon-option'}
                  onClick={() => {
                    setIcon(key)
                    setIconTouched(true)
                  }}
                  aria-pressed={selected}
                  aria-label={`Välj ikon ${key}`}
                >
                  <OptionIcon size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </fieldset>
        <button type="submit" className="btn primary" disabled={submitting || !name.trim()}>
          {submitting ? 'Skapar…' : 'Skapa lista'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}
      {!loading && lists.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="Inga listor än"
          description="Skapa familjens första lista ovan."
        />
      )}

      <div className="lists-grid">
        {lists.map((list) => {
          const remaining = remainingByList.get(list.id) ?? 0

          return (
            <article key={list.id} className="card lists-card">
              <Link to={`/listor/${list.id}`} className="lists-card-link">
                <span className="lists-card-icon" aria-hidden="true">
                  <ListIcon icon={list.icon} type={list.type} size={22} />
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
                <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
