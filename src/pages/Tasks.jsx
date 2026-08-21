import { useState } from 'react'
import { useCollection } from '../lib/useCollection'

export default function Tasks() {
  const { items, loading, error, add, update, remove } = useCollection('tasks')
  const [title, setTitle] = useState('')

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle('')
    await add({ title: trimmed, done: false })
  }

  return (
    <div className="page">
      <h1 className="page-title">Uppgifter ✅</h1>

      <form onSubmit={handleAdd} className="add-row">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ny uppgift…"
        />
        <button type="submit" className="btn primary">
          Lägg till
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && items.length === 0 && <p className="muted">Inga uppgifter än.</p>}

      <ul className="list">
        {items.map((task) => (
          <li key={task.id} className={task.done ? 'list-item done' : 'list-item'}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => update(task.id, { done: !task.done })}
              />
              <span>{task.title}</span>
            </label>
            <button
              type="button"
              className="btn icon"
              onClick={() => remove(task.id)}
              aria-label="Ta bort"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
