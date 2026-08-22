import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../lib/useCollection'
import './Contacts.css'

const emptyForm = { name: '', phone: '', email: '', birthday: '', category: '', note: '' }

const cleanForm = (form) => ({
  name: form.name.trim(),
  phone: form.phone.trim() || null,
  email: form.email.trim() || null,
  birthday: form.birthday || null,
  category: form.category.trim() || null,
  note: form.note.trim() || null,
})

const formatBirthday = (birthday) => {
  const [, month, day] = birthday.split('-')
  return `${Number(day)}/${Number(month)}`
}

export default function Contacts() {
  const { items, loading, error, add, update, remove } = useCollection('contacts')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    const base = [...items].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    if (!query) return base
    return base.filter((contact) => contact.name.toLowerCase().includes(query))
  }, [items, debouncedSearch])

  const handleAdd = async (event) => {
    event.preventDefault()
    const fields = cleanForm(form)
    if (!fields.name) return
    await add(fields)
    setForm(emptyForm)
  }

  const startEdit = (contact) => {
    setEditingId(contact.id)
    setEditForm({
      name: contact.name ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      birthday: contact.birthday ?? '',
      category: contact.category ?? '',
      note: contact.note ?? '',
    })
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    const fields = cleanForm(editForm)
    if (!fields.name) return
    await update(editingId, fields)
    setEditingId(null)
  }

  return (
    <div className="page">
      <h1 className="page-title">Kontakter 📇</h1>

      <input
        type="text"
        className="contact-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Sök på namn…"
        aria-label="Sök kontakter efter namn"
      />

      <form onSubmit={handleAdd} className="form card">
        <label>
          Namn
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="För- och efternamn"
          />
        </label>
        <label>
          Telefon
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Valfritt"
          />
        </label>
        <label>
          E-post
          <input
            type="text"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Valfritt"
          />
        </label>
        <label>
          Födelsedag
          <input
            type="date"
            value={form.birthday}
            onChange={(e) => setForm({ ...form, birthday: e.target.value })}
          />
        </label>
        <label>
          Kategori
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="T.ex. Familj, Skola…"
          />
        </label>
        <label>
          Notis
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Valfri notis…"
          />
        </label>
        <button type="submit" className="btn primary">
          Lägg till
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && filtered.length === 0 && (
        <p className="muted">
          {debouncedSearch.trim() ? 'Inga kontakter matchar sökningen.' : 'Inga kontakter än.'}
        </p>
      )}

      <ul className="list">
        {filtered.map((contact) =>
          editingId === contact.id ? (
            <li key={contact.id} className="list-item contact-item">
              <form onSubmit={handleSaveEdit} className="form contact-edit">
                <label>
                  Namn
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Telefon
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </label>
                <label>
                  E-post
                  <input
                    type="text"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </label>
                <label>
                  Födelsedag
                  <input
                    type="date"
                    value={editForm.birthday}
                    onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                  />
                </label>
                <label>
                  Kategori
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  />
                </label>
                <label>
                  Notis
                  <input
                    type="text"
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  />
                </label>
                <div className="add-row">
                  <button type="submit" className="btn primary">
                    Spara
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>
                    Avbryt
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li key={contact.id} className="list-item contact-item">
              <div className="contact-item-main">
                <div className="contact-info">
                  <span className="contact-name">{contact.name}</span>
                  {contact.category && <span className="muted small">{contact.category}</span>}
                  {contact.phone && (
                    <a className="contact-link" href={`tel:${contact.phone}`}>
                      📞 {contact.phone}
                    </a>
                  )}
                  {contact.email && (
                    <a className="contact-link" href={`mailto:${contact.email}`}>
                      ✉️ {contact.email}
                    </a>
                  )}
                  {contact.birthday && (
                    <span className="muted small">
                      🎂 Födelsedag {formatBirthday(contact.birthday)}
                    </span>
                  )}
                  {contact.note && <span className="muted small">{contact.note}</span>}
                </div>
                <div className="contact-actions">
                  <button
                    type="button"
                    className="btn icon"
                    onClick={() => startEdit(contact)}
                    aria-label={`Redigera kontakten ${contact.name}`}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="btn icon"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Vill du ta bort kontakten "${contact.name}"? Detta går inte att ångra.`,
                        )
                      )
                        return
                      remove(contact.id)
                    }}
                    aria-label={`Ta bort kontakten ${contact.name}`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
