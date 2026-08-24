import { useEffect, useMemo, useState } from 'react'
import { Trash2, Wallet } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import {
  convertAmount,
  fetchEurSekRate,
  formatEurSekRate,
  formatRateDate,
  useEurSekRate,
  useEurSekRates,
} from '../lib/exchangeRate'
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

function rateForEntry(entry, fetchedRates) {
  if (entry.eur_sek_rate != null) return Number(entry.eur_sek_rate)
  return fetchedRates[entry.entry_date]?.rate ?? null
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
  const [goalAmount, setGoalAmount] = useState('')
  const [entrySubmitting, setEntrySubmitting] = useState(false)
  const [entryError, setEntryError] = useState('')
  const [goalSubmitting, setGoalSubmitting] = useState(false)
  const [goalError, setGoalError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState(null)

  useEffect(() => {
    if (!householdId || !supabase) return

    let active = true
    const loadSettings = async () => {
      const { data, error: fetchError } = await supabase
        .from('budget_settings')
        .select('base_currency')
        .eq('household_id', householdId)
        .maybeSingle()

      if (!active) return
      if (fetchError) {
        setSettingsError(fetchError.message)
      } else if (data) {
        setBaseCurrency(data.base_currency)
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
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId])

  const needsConversion = currency !== baseCurrency
  const previewRate = useEurSekRate(entryDate, needsConversion)
  const missingRateDates = useMemo(
    () =>
      items
        .filter((entry) => (entry.currency || 'SEK') !== baseCurrency && entry.eur_sek_rate == null)
        .map((entry) => entry.entry_date),
    [items, baseCurrency],
  )
  const fetchedRates = useEurSekRates(missingRateDates)

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
        rateForEntry(entry, fetchedRates),
      )
      if (value == null) continue
      if (entry.kind === 'inkomst') inc += value
      else exp += value
    }
    return { income: inc, expense: exp, balance: inc - exp }
  }, [monthlyEntries, baseCurrency, fetchedRates])

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
          rateForEntry(entry, fetchedRates),
        )
        if (value == null) continue
        if (entry.kind === 'inkomst') monthIncome += value
        else monthExpense += value
      }
      return { month, income: monthIncome, expense: monthExpense }
    })
  }, [items, selectedMonth, baseCurrency, fetchedRates])

  const chartMaximum = Math.max(
    1,
    ...chartData.flatMap((month) => [month.income, month.expense]),
  )
  const goal = Number(selectedGoal?.amount) || 0
  const goalPercentage = goal > 0 ? (expense / goal) * 100 : 0
  const isOverGoal = goal > 0 && expense > goal

  const handleAdd = async (event) => {
    event.preventDefault()
    if (entrySubmitting) return
    const value = parseFloat(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setEntryError('Ange ett giltigt belopp större än noll.')
      return
    }
    setEntrySubmitting(true)
    setEntryError('')
    const fields = {
      kind,
      category: category.trim() || null,
      amount: value,
      note: note.trim() || null,
      entry_date: entryDate || today(),
      currency,
    }

    if (currency !== baseCurrency) {
      try {
        const { rate } = await fetchEurSekRate(entryDate || today())
        fields.eur_sek_rate = rate
      } catch {
        setEntryError('Växelkursen för det datumet kunde inte hämtas. Kontrollera nätet och försök igen.')
        setEntrySubmitting(false)
        return
      }
    }

    const wasAdded = await add(fields)
    if (wasAdded) {
      setCategory('')
      setAmount('')
      setNote('')
      setEntryDate(today())
    } else {
      setEntryError('Budgetposten kunde inte sparas. Försök igen.')
    }
    setEntrySubmitting(false)
  }

  const handleSaveSettings = async (event) => {
    event.preventDefault()
    if (settingsSaving) return

    setSettingsSaving(true)
    setSettingsError(null)
    const { error: saveError } = await supabase.from('budget_settings').upsert({
      household_id: householdId,
      base_currency: baseCurrency,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    if (saveError) setSettingsError(saveError.message)
    setSettingsSaving(false)
  }

  const handleSaveGoal = async (event) => {
    event.preventDefault()
    if (goalSubmitting) return
    const value = Number.parseFloat(String(goalAmount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setGoalError('Ange en giltig månadsbudget större än noll.')
      return
    }

    setGoalSubmitting(true)
    setGoalError('')
    const wasSaved = selectedGoal
      ? await updateGoal(selectedGoal.id, { amount: value })
      : await addGoal({ month: selectedMonth, amount: value })
    if (!wasSaved) setGoalError('Månadsbudgeten kunde inte sparas. Försök igen.')
    setGoalSubmitting(false)
  }

  const handleRemoveEntry = (entry) => {
    const entryName = entry.category || (entry.kind === 'inkomst' ? 'inkomst' : 'utgift')
    if (!window.confirm(`Vill du ta bort budgetposten "${entryName}"? Detta går inte att ångra.`))
      return
    remove(entry.id)
  }

  return (
    <div className="page">
      <h1 className="page-title">Budget</h1>

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
        <form className="add-row budget-goal-form" onSubmit={handleSaveGoal} noValidate>
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
          <button type="submit" className="btn secondary" disabled={goalSubmitting}>
            {goalSubmitting ? 'Sparar…' : selectedGoal ? 'Uppdatera' : 'Sätt budget'}
          </button>
        </form>
        {goalError && <p className="error">{goalError}</p>}
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

      <form onSubmit={handleAdd} className="form card budget-form" noValidate>
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
        {needsConversion && (
          <p className="muted small budget-rate-hint">
            {previewRate.loading && 'Hämtar dagens växelkurs…'}
            {previewRate.error && previewRate.error}
            {!previewRate.loading && !previewRate.error && previewRate.rate && (
              <>
                Automatisk kurs {formatRateDate(previewRate.rateDate)}: 1 EUR ={' '}
                {formatEurSekRate(previewRate.rate)} SEK
                {previewRate.rateDate !== entryDate
                  ? ' (närmaste bankdag – helger har ingen egen kurs)'
                  : ''}
              </>
            )}
          </p>
        )}
        <button
          type="submit"
          className="btn primary"
          disabled={entrySubmitting || (needsConversion && !previewRate.rate)}
        >
          {entrySubmitting ? 'Sparar…' : 'Lägg till'}
        </button>
        {entryError && <p className="error">{entryError}</p>}
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
          <p className="muted small">
            EUR räknas om automatiskt med ECB:s dagskurs för postens datum. Helger och röda dagar
            använder närmaste bankdag.
          </p>
          <button type="submit" className="btn secondary" disabled={settingsSaving}>
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
          icon={Wallet}
          title="Inga budgetposter"
          description="Det finns inga poster för den här månaden."
        />
      )}

      <ul className="list">
        {monthlyEntries.map((entry) => {
          const entryCurrency = entry.currency || 'SEK'
          const entryRate = rateForEntry(entry, fetchedRates)
          const convertedAmount = convertAmount(
            entry.amount,
            entryCurrency,
            baseCurrency,
            entryRate,
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
                  {formatAmount(convertedAmount ?? entry.amount, convertedAmount == null ? entryCurrency : baseCurrency)}
                </span>
                <button
                  type="button"
                  className="btn icon"
                  onClick={() => handleRemoveEntry(entry)}
                  aria-label={`Ta bort budgetposten ${
                    entry.category || (entry.kind === 'inkomst' ? 'inkomst' : 'utgift')
                  }`}
                >
                  <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              {entryCurrency !== baseCurrency && (
                <span className="muted small budget-original-amount">
                  Ursprungligt belopp: {formatAmount(entry.amount, entryCurrency)}
                  {entryRate
                    ? ` · 1 EUR = ${formatEurSekRate(entryRate)} SEK`
                    : ''}
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
