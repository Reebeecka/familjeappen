import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import './Search.css'

const SEARCH_GROUPS = [
  {
    key: 'listItems',
    title: 'Listor',
    icon: '📋',
    table: 'list_items',
    select: 'id, title, list_id',
    column: 'title',
    getLabel: (item) => item.title,
    getPath: (item) => `/listor/${item.list_id}`,
  },
  {
    key: 'calendarEvents',
    title: 'Kalender',
    icon: '📅',
    table: 'calendar_events',
    select: 'id, title, start_at',
    column: 'title',
    getLabel: (item) => item.title,
    getPath: () => '/kalender',
  },
  {
    key: 'contacts',
    title: 'Kontakter',
    icon: '📇',
    table: 'contacts',
    select: 'id, name',
    column: 'name',
    getLabel: (item) => item.name,
    getPath: () => '/kontakter',
  },
  {
    key: 'recipes',
    title: 'Recept',
    icon: '📖',
    table: 'recipes',
    select: 'id, title',
    column: 'title',
    getLabel: (item) => item.title,
    getPath: () => '/recept',
  },
  {
    key: 'documents',
    title: 'Dokument',
    icon: '📁',
    table: 'documents',
    select: 'id, name',
    column: 'name',
    getLabel: (item) => item.name,
    getPath: () => '/dokument',
  },
]

const EMPTY_RESULTS = Object.fromEntries(SEARCH_GROUPS.map((group) => [group.key, []]))

export default function Search() {
  const { householdId } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!debouncedSearch || !householdId || !supabase) {
      return
    }

    let active = true

    const runSearch = async () => {
      setLoading(true)
      setError('')

      const responses = await Promise.all(
        SEARCH_GROUPS.map(async (group) => {
          const { data, error: searchError } = await supabase
            .from(group.table)
            .select(group.select)
            .eq('household_id', householdId)
            .ilike(group.column, `%${debouncedSearch}%`)
            .limit(20)

          return { key: group.key, data: data ?? [], error: searchError }
        }),
      )

      if (!active) return

      const nextResults = { ...EMPTY_RESULTS }
      responses.forEach((response) => {
        nextResults[response.key] = response.data
      })
      setResults(nextResults)
      setError(
        responses.some((response) => response.error)
          ? 'Några kategorier kunde inte sökas just nu.'
          : '',
      )
      setLoading(false)
    }

    runSearch()

    return () => {
      active = false
    }
  }, [debouncedSearch, householdId])

  const visibleGroups = SEARCH_GROUPS.filter((group) => results[group.key].length > 0)
  const hasSearched = Boolean(debouncedSearch)

  const handleSearchChange = (event) => {
    const nextSearch = event.target.value
    setSearch(nextSearch)
    if (!nextSearch.trim()) {
      setResults(EMPTY_RESULTS)
      setLoading(false)
      setError('')
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Sök 🔍</h1>

      <label className="search-field">
        <span className="search-label">Sök i familjens innehåll</span>
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Sök listor, kalender, kontakter…"
          autoComplete="off"
          autoFocus
        />
      </label>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Söker…</p>}

      {!hasSearched && !loading && (
        <div className="card search-empty">
          <span aria-hidden="true">🔎</span>
          <p className="muted">Skriv något för att söka i familjens innehåll.</p>
        </div>
      )}

      {hasSearched && !loading && visibleGroups.length === 0 && (
        <div className="card search-empty">
          <span aria-hidden="true">🤷</span>
          <p>Inga träffar på ”{debouncedSearch}”.</p>
          <p className="muted small">Prova ett annat eller kortare sökord.</p>
        </div>
      )}

      {hasSearched && !loading && (
        <div className="search-groups">
          {visibleGroups.map((group) => (
            <section key={group.key} className="search-group">
              <h2 className="search-group-title">
                <span aria-hidden="true">{group.icon}</span>
                {group.title}
                <span className="search-count">{results[group.key].length}</span>
              </h2>
              <ul className="list">
                {results[group.key].map((item) => (
                  <li key={item.id}>
                    <Link className="list-item search-result" to={group.getPath(item)}>
                      <span>{group.getLabel(item)}</span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
