import { useState } from 'react'
import { useCollection } from '../lib/useCollection'

export default function Shopping() {
  const { items, loading, error, add, update, remove } = useCollection('shopping_items')
  const [name, setName] = useState('')

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    await add({ name: trimmed, checked: false })
  }

  return (
    <div className="page">
      <h1 className="page-title">Inköpslista 🛒</h1>

      <form onSubmit={handleAdd} className="add-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ny vara…"
        />
        <button type="submit" className="btn primary">
          Lägg till
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && items.length === 0 && <p className="muted">Listan är tom.</p>}

      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className={item.checked ? 'list-item done' : 'list-item'}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => update(item.id, { checked: !item.checked })}
              />
              <span>{item.name}</span>
            </label>
            <button
              type="button"
              className="btn icon"
              onClick={() => remove(item.id)}
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
