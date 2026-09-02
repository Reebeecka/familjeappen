import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarPlus, ExternalLink, RefreshCw, Trophy } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { supabase } from '../lib/supabase'
import { useCollection } from '../lib/useCollection'
import { useRugbyMatches } from '../lib/useRugbyMatches'
import {
  RUGBY_CLUB_IDS,
  RUGBY_CLUBS,
  calendarPayloadForMatch,
  driveLabel,
  formatMatchWhen,
  isFinished,
  isMatchOnCalendar,
  matchTitle,
  ticketUrlForMatch,
  venueForMatch,
} from '../lib/rugbyClubs'
import './Rugby.css'

function MatchCard({ match, onCalendar, adding, onAdd }) {
  const tickets = ticketUrlForMatch(match)
  const venue = venueForMatch(match)
  const drive = driveLabel(match)
  const finished = isFinished(match)
  const score =
    match.home_score != null && match.away_score != null
      ? `${match.home_score}–${match.away_score}`
      : null

  return (
    <article className="list-item rugby-match">
      <p className="rugby-match-meta">
        {formatMatchWhen(match)} · {match.league_name}
      </p>
      <h2 className="rugby-match-title">{matchTitle(match)}</h2>
      {finished && score && <p className="rugby-match-score">{score}</p>}
      {venue && (
        <p className="muted small">
          {venue}
          {drive ? ` · ${drive}` : ''}
        </p>
      )}
      {!finished && (
        <div className="rugby-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={onCalendar || adding}
            onClick={() => onAdd(match)}
          >
            <CalendarPlus size={16} strokeWidth={1.75} aria-hidden="true" />
            {onCalendar ? 'Tillagd' : adding ? 'Sparar…' : 'Vi åker'}
          </button>
          {tickets && (
            <a
              className="btn primary"
              href={tickets}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
              Köp biljett
            </a>
          )}
        </div>
      )}
    </article>
  )
}

export default function Rugby() {
  const fromIso = useMemo(() => {
    const start = new Date()
    start.setDate(start.getDate() - 21)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }, [])
  const { items, loading, error, reload } = useRugbyMatches(fromIso)
  const { items: calendarEvents, add } = useCollection('calendar_events', 'start_at')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncFailed, setSyncFailed] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [addError, setAddError] = useState('')
  const [view, setView] = useState('upcoming')
  const [selectedClubIds, setSelectedClubIds] = useState(() => new Set(RUGBY_CLUB_IDS))
  const syncingRef = useRef(false)
  const autoSyncStarted = useRef(false)

  const todayStart = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }, [])
  const visibleItems = items.filter((match) => selectedClubIds.has(Number(match.home_team_id)))
  const upcoming = visibleItems.filter((match) => new Date(match.kickoff_at).getTime() >= todayStart)
  const results = visibleItems
    .filter((match) => new Date(match.kickoff_at).getTime() < todayStart)
    .reverse()
  const filterEmptyHint =
    selectedClubIds.size === 0
      ? 'Tryck på ett lag ovanför för att visa dess hemmamatcher.'
      : selectedClubIds.size < RUGBY_CLUBS.length
        ? 'Inga matcher för de lag du valt just nu.'
        : null

  const toggleClub = (clubId) => {
    setSelectedClubIds((current) => {
      const next = new Set(current)
      if (next.has(clubId)) next.delete(clubId)
      else next.add(clubId)
      return next
    })
  }

  const handleSync = useCallback(async () => {
    if (syncingRef.current || !supabase) return
    syncingRef.current = true
    setSyncing(true)
    setSyncMessage('')
    setSyncFailed(false)
    const { data, error: invokeError } = await supabase.functions.invoke('sync-rugby', {
      body: {},
    })
    const payload = data && typeof data === 'object' ? data : null
    const saved = Number(payload?.saved) || 0
    if (payload?.success === true || saved > 0) {
      const extra =
        Array.isArray(payload?.warnings) && payload.warnings.length > 0
          ? ` ${payload.warnings[0]}`
          : ''
      setSyncMessage(
        saved ? `${saved} matcher uppdaterade.${extra}` : `Inga matcher att spara just nu.${extra}`,
      )
    } else {
      setSyncFailed(true)
      setSyncMessage(
        items.length > 0
          ? 'Kunde inte uppdatera just nu. Matcher du redan ser är kvar.'
          : 'Kunde inte hämta matcher just nu. Försök igen.',
      )
    }
    await reload()
    syncingRef.current = false
    setSyncing(false)
  }, [items.length, reload])

  useEffect(() => {
    if (loading || autoSyncStarted.current || items.length > 0) return
    autoSyncStarted.current = true
    handleSync()
  }, [handleSync, items.length, loading])

  const handleAdd = async (match) => {
    if (addingId) return
    setAddingId(match.api_id)
    setAddError('')
    const wasAdded = await add(calendarPayloadForMatch(match))
    if (!wasAdded) setAddError('Matchen kunde inte läggas i kalendern. Försök igen.')
    setAddingId(null)
  }

  return (
    <div className="page">
      <div className="rugby-header">
        <h1 className="page-title">Rugby</h1>
        <button type="button" className="btn ghost" onClick={handleSync} disabled={syncing}>
          <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
          {syncing ? 'Hämtar…' : 'Uppdatera'}
        </button>
      </div>

      <div className="rugby-clubs" role="group" aria-label="Filtrera lag">
        {RUGBY_CLUBS.map((club) => {
          const selected = selectedClubIds.has(club.id)
          return (
            <button
              key={club.id}
              type="button"
              className={selected ? 'rugby-chip selected' : 'rugby-chip'}
              aria-pressed={selected}
              onClick={() => toggleClub(club.id)}
            >
              {club.short}
              <span className="rugby-chip-league">{club.league}</span>
            </button>
          )
        })}
      </div>

      {syncMessage && <p className={syncFailed ? 'error' : 'info'}>{syncMessage}</p>}
      {addError && <p className="error">{addError}</p>}
      {error && <p className="error">{error}</p>}
      <div className="rugby-view-toggle" aria-label="Rugbyvy">
        <button
          type="button"
          className={`btn ${view === 'upcoming' ? 'primary' : 'ghost'}`}
          onClick={() => setView('upcoming')}
          aria-pressed={view === 'upcoming'}
        >
          Kommande
        </button>
        <button
          type="button"
          className={`btn ${view === 'results' ? 'primary' : 'ghost'}`}
          onClick={() => setView('results')}
          aria-pressed={view === 'results'}
        >
          Resultat
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && view === 'upcoming' && upcoming.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Inga kommande matcher"
          description={
            filterEmptyHint ??
            'Tryck på Uppdatera för att hämta matcher från Top 14 och Pro D2.'
          }
        />
      )}

      {!loading && view === 'results' && results.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Inga resultat ännu"
          description={filterEmptyHint ?? 'Här visas matcher som redan har spelats.'}
        />
      )}

      {!loading && view === 'upcoming' && upcoming.length > 0 && (
        <div className="list">
          {upcoming.map((match) => (
            <MatchCard
              key={match.api_id}
              match={match}
              onCalendar={isMatchOnCalendar(calendarEvents, match)}
              adding={addingId === match.api_id}
              onAdd={handleAdd}
            />
          ))}
        </div>
      )}

      {!loading && view === 'results' && results.length > 0 && (
        <div className="list">
          {results.map((match) => (
            <MatchCard
              key={match.api_id}
              match={match}
              onCalendar={isMatchOnCalendar(calendarEvents, match)}
              adding={false}
              onAdd={handleAdd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
