import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useCollection } from '../lib/useCollection'
import './Budget.css'

const today = () => {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
const currentMonth = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const formatAmount = (value, currency) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const formatDate = (value) => new Date(value).toLocaleDateString('sv-SE')

const formatMonth = (month, short = false) => {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('sv-SE', {
    month: short ? 'short' : 'long',
    year: short ? undefined : 'numeric',
  }).format(new Date(year, monthNumber - 1, 1))
}

const moveMonth = (month, difference) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + difference, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const entryMonth = (entry) => entry.entry_date.slice(0, 7)

const convertAmount = (amount, currency, baseCurrency, eurSekRate) => {
  const value = Number(amount) || 0
  if (currency === baseCurrency) return value
  return currency === 'EUR' ? value * eurSekRate : value / eurSekRate
}

export default function Budget() {
  const { householdId, user } = useAuth()
  const { items, loading, error, add, remove } = useCollection('budget_entries')
  const {
    items: goals,
    loading: goalsLoading,
    error: goalsError,
    add: addGoal,
    update: updateGoal,
  } = useCollection('budget_goals', 'month')
  const [kind, setKind] = useState('utgift')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [entryDate, setEntryDate] = useState(today)
  const [currency, setCurrency] = useState('SEK')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [baseCurrency, setBaseCurrency] = useState('SEK')
  const [eurSekRate, setEurSekRate] = useState('11.5')
  const [goalAmount, setGoalAmount] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState(null)

  useEffect(() => {
    if (!householdId || !supabase) return

    let active = true
    const loadSettings = async () => {
      const { data, error: fetchError } = await supabase
        .from('budget_settings')
        .select('base_currency, eur_sek_rate')
        .eq('household_id', householdId)
        .maybeSingle()

      if (!active) return
      if (fetchError) {
        setSettingsError(fetchError.message)
      } else if (data) {
        setBaseCurrency(data.base_currency)
        setEurSekRate(String(data.eur_sek_rate))
      }
      setSettingsLoading(false)
    }
    loadSettings()

    const channel = supabase
      .channel(`budget_settings-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budget_settings',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setBaseCurrency(payload.new.base_currency)
          setEurSekRate(String(payload.new.eur_sek_rate))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId])

  const rate = Number.parseFloat(String(eurSekRate).replace(',', '.'))
  const validRate = Number.isFinite(rate) && rate > 0

  const monthlyEntries = useMemo(
    () =>
      items
        .filter((entry) => entryMonth(entry) === selectedMonth)
        .sort(
          (a, b) =>
            new Date(b.entry_date) - new Date(a.entry_date) ||
            new Date(b.created_at) - new Date(a.created_at),
        ),
    [items, selectedMonth],
  )

  const { income, expense, balance } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const entry of monthlyEntries) {
      const value = convertAmount(
        entry.amount,
        entry.currency || 'SEK',
        baseCurrency,
        validRate ? rate : 11.5,
      )
      if (entry.kind === 'inkomst') inc += value
      else exp += value
    }
    return { income: inc, expense: exp, balance: inc - exp }
  }, [monthlyEntries, baseCurrency, rate, validRate])

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.month === selectedMonth),
    [goals, selectedMonth],
  )

  useEffect(() => {
    setGoalAmount(selectedGoal ? String(selectedGoal.amount) : '')
  }, [selectedGoal])

  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => moveMonth(selectedMonth, index - 5))
    return months.map((month) => {
      let monthIncome = 0
      let monthExpense = 0
      for (const entry of items) {
        if (entryMonth(entry) !== month) continue
        const value = convertAmount(
          entry.amount,
          entry.currency || 'SEK',
          baseCurrency,
          validRate ? rate : 11.5,
        )
        if (entry.kind === 'inkomst') monthIncome += value
        else monthExpense += value
      }
      return { month, income: monthIncome, expense: monthExpense }
    })
  }, [items, selectedMonth, baseCurrency, rate, validRate])

  const chartMaximum = Math.max(
    1,
    ...chartData.flatMap((month) => [month.income, month.expense]),
  )
  const goal = Number(selectedGoal?.amount) || 0
  const goalPercentage = goal > 0 ? (expense / goal) * 100 : 0
  const isOverGoal = goal > 0 && expense > goal

  const handleAdd = async (event) => {
    event.preventDefault()
    const value = parseFloat(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    const wasAdded = await add({
      kind,
      category: category.trim() || null,
      amount: value,
      note: note.trim() || null,
      entry_date: entryDate || today(),
      currency,
    })
    if (!wasAdded) return

    setCategory('')
    setAmount('')
    setNote('')
    setEntryDate(today())
  }

  const handleSaveSettings = async (event) => {
    event.preventDefault()
    if (!validRate) return

    setSettingsSaving(true)
    setSettingsError(null)
    const { error: saveError } = await supabase.from('budget_settings').upsert({
      household_id: householdId,
      base_currency: baseCurrency,
      eur_sek_rate: rate,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    if (saveError) setSettingsError(saveError.message)
    setSettingsSaving(false)
  }

  const handleSaveGoal = async (event) => {
    event.preventDefault()
    const value = Number.parseFloat(String(goalAmount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return

    if (selectedGoal) await updateGoal(selectedGoal.id, { amount: value })
    else await addGoal({ month: selectedMonth, amount: value })
  }

  const handleRemoveEntry = (entry) => {
    const entryName = entry.category || (entry.kind === 'inkomst' ? 'inkomst' : 'utgift')
    if (!window.confirm(`Vill du ta bort budgetposten "${entryName}"? Detta går inte att ångra.`))
      return
    remove(entry.id)
  }

  return (
    <div className="page">
      <h1 className="page-title">Budget 💰</h1>

      <div className="budget-month-picker" aria-label="Välj månad">
        <button
          type="button"
          className="btn ghost"
          onClick={() => setSelectedMonth((month) => moveMonth(month, -1))}
          aria-label="Föregående månad"
        >
          ←
        </button>
        <strong>{formatMonth(selectedMonth)}</strong>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setSelectedMonth((month) => moveMonth(month, 1))}
          aria-label="Nästa månad"
        >
          →
        </button>
      </div>

      <div className="card budget-summary">
        <div className="summary-item">
          <span className="summary-label">Inkomst</span>
          <span className="summary-value income">{formatAmount(income, baseCurrency)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Utgift</span>
          <span className="summary-value expense">{formatAmount(expense, baseCurrency)}</span>
        </div>
        <div className="summary-item summary-balance">
          <span className="summary-label">Saldo</span>
          <span className={balance >= 0 ? 'summary-value income' : 'summary-value expense'}>
            {formatAmount(balance, baseCurrency)}
          </span>
        </div>
      </div>

      <div className={`card budget-goal ${isOverGoal ? 'over-goal' : ''}`}>
        <div className="budget-section-heading">
          <div>
            <h2>Månadsbudget</h2>
            {goal > 0 && (
              <span className="muted small">
                {formatAmount(expense, baseCurrency)} av {formatAmount(goal, baseCurrency)}
              </span>
            )}
          </div>
          {goal > 0 && <strong>{Math.round(goalPercentage)} %</strong>}
        </div>
        {goal > 0 && (
          <div
            className="budget-progress"
            role="progressbar"
            aria-label="Använd månadsbudget"
            aria-valuenow={Math.min(Math.round(goalPercentage), 100)}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span style={{ width: `${Math.min(goalPercentage, 100)}%` }} />
          </div>
        )}
        <form className="add-row budget-goal-form" onSubmit={handleSaveGoal}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={goalAmount}
            onChange={(event) => setGoalAmount(event.target.value)}
            placeholder={`Budget i ${baseCurrency}`}
            aria-label={`Månadsbudget i ${baseCurrency}`}
          />
          <button type="submit" className="btn secondary">
            {selectedGoal ? 'Uppdatera' : 'Sätt budget'}
          </button>
        </form>
      </div>

      <div className="card budget-chart">
        <div className="budget-section-heading">
          <h2>Senaste sex månaderna</h2>
          <div className="chart-legend small">
            <span>
              <i className="income-dot" />
              Inkomst
            </span>
            <span>
              <i className="expense-dot" />
              Utgift
            </span>
          </div>
        </div>
        <div
          className="chart-bars"
          role="img"
          aria-label="Stapeldiagram över inkomster och utgifter de senaste sex månaderna"
        >
          {chartData.map((month) => (
            <div className="chart-month" key={month.month}>
              <div className="chart-pair">
                <span
                  className="chart-bar income-bar"
                  style={{ height: `${(month.income / chartMaximum) * 100}%` }}
                  title={`Inkomst: ${formatAmount(month.income, baseCurrency)}`}
                />
                <span
                  className="chart-bar expense-bar"
                  style={{ height: `${(month.expense / chartMaximum) * 100}%` }}
                  title={`Utgift: ${formatAmount(month.expense, baseCurrency)}`}
                />
              </div>
              <span>{formatMonth(month.month, true).replace('.', '')}</span>
            </div>
          ))}
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
            Belopp
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
          <label>
            Valuta
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="SEK">SEK</option>
              <option value="EUR">EUR</option>
            </select>
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

      <details className="card budget-settings">
        <summary>Valutainställningar</summary>
        <form className="form" onSubmit={handleSaveSettings}>
          <label>
            Huvudvaluta
            <select
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value)}
              disabled={settingsLoading}
            >
              <option value="SEK">SEK</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Växelkurs (1 EUR i SEK)
            <input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0.0001"
              value={eurSekRate}
              onChange={(event) => setEurSekRate(event.target.value)}
              disabled={settingsLoading}
            />
          </label>
          <button type="submit" className="btn secondary" disabled={settingsSaving || !validRate}>
            {settingsSaving ? 'Sparar…' : 'Spara inställningar'}
          </button>
        </form>
      </details>

      {(error || goalsError || settingsError) && (
        <p className="error">{error || goalsError || settingsError}</p>
      )}
      {(loading || goalsLoading) && <Spinner />}
      {!loading && monthlyEntries.length === 0 && (
        <EmptyState
          icon="💰"
          title="Inga budgetposter"
          description="Det finns inga poster för den här månaden."
        />
      )}

      <ul className="list">
        {monthlyEntries.map((entry) => {
          const entryCurrency = entry.currency || 'SEK'
          const convertedAmount = convertAmount(
            entry.amount,
            entryCurrency,
            baseCurrency,
            validRate ? rate : 11.5,
          )
          return (
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
                  {formatAmount(convertedAmount, baseCurrency)}
                </span>
                <button
                  type="button"
                  className="btn icon"
                  onClick={() => handleRemoveEntry(entry)}
                  aria-label={`Ta bort budgetposten ${
                    entry.category || (entry.kind === 'inkomst' ? 'inkomst' : 'utgift')
                  }`}
                >
                  🗑️
                </button>
              </div>
              {entryCurrency !== baseCurrency && (
                <span className="muted small budget-original-amount">
                  Ursprungligt belopp: {formatAmount(entry.amount, entryCurrency)}
                </span>
              )}
              {entry.note && <span className="muted small">{entry.note}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
