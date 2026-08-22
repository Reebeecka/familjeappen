import { useMemo, useState } from 'react'
import { useCollection } from '../lib/useCollection'
import './Budget.css'

const today = () => new Date().toISOString().slice(0, 10)

const formatAmount = (value) =>
  `${Number(value).toLocaleString('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`

const formatDate = (value) => new Date(value).toLocaleDateString('sv-SE')

export default function Budget() {
  const { items, loading, error, add, remove } = useCollection('budget_entries')
  const [kind, setKind] = useState('utgift')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [entryDate, setEntryDate] = useState(today)

  const { income, expense, balance } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const entry of items) {
      const value = Number(entry.amount) || 0
      if (entry.kind === 'inkomst') inc += value
      else exp += value
    }
    return { income: inc, expense: exp, balance: inc - exp }
  }, [items])

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.entry_date) - new Date(a.entry_date) ||
          new Date(b.created_at) - new Date(a.created_at),
      ),
    [items],
  )

  const handleAdd = async (event) => {
    event.preventDefault()
    const value = parseFloat(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    await add({
      kind,
      category: category.trim() || null,
      amount: value,
      note: note.trim() || null,
      entry_date: entryDate || today(),
    })
    setCategory('')
    setAmount('')
    setNote('')
    setEntryDate(today())
  }

  return (
    <div className="page">
      <h1 className="page-title">Budget 💰</h1>

      <div className="card budget-summary">
        <div className="summary-item">
          <span className="summary-label">Total inkomst</span>
          <span className="summary-value income">{formatAmount(income)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total utgift</span>
          <span className="summary-value expense">{formatAmount(expense)}</span>
        </div>
        <div className="summary-item summary-balance">
          <span className="summary-label">Saldo</span>
          <span className={balance >= 0 ? 'summary-value income' : 'summary-value expense'}>
            {formatAmount(balance)}
          </span>
        </div>
      </div>

      <form onSubmit={handleAdd} className="form card budget-form">
        <div className="form-row">
          <label>
            Typ
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="utgift">Utgift</option>
              <option value="inkomst">Inkomst</option>
            </select>
          </label>
          <label>
            Belopp (kr)
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </label>
        </div>
        <label>
          Kategori
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="T.ex. Mat, Lön…"
          />
        </label>
        <label>
          Notis
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Valfri notis…"
          />
        </label>
        <label>
          Datum
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </label>
        <button type="submit" className="btn primary">
          Lägg till
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && sorted.length === 0 && <p className="muted">Inga poster än.</p>}

      <ul className="list">
        {sorted.map((entry) => (
          <li key={entry.id} className="list-item budget-item">
            <div className="budget-item-main">
              <div className="budget-item-info">
                <span>{entry.category || (entry.kind === 'inkomst' ? 'Inkomst' : 'Utgift')}</span>
                <span className="muted small">{formatDate(entry.entry_date)}</span>
              </div>
              <span
                className={
                  entry.kind === 'inkomst'
                    ? 'budget-item-amount income'
                    : 'budget-item-amount expense'
                }
              >
                {entry.kind === 'inkomst' ? '+' : '−'}
                {formatAmount(entry.amount)}
              </span>
              <button
                type="button"
                className="btn icon"
                onClick={() => remove(entry.id)}
                aria-label="Ta bort"
              >
                🗑️
              </button>
            </div>
            {entry.note && <span className="muted small">{entry.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
