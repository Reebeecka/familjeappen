import { useMemo, useState } from 'react'
import { CalendarPlus, ExternalLink, RefreshCw, Trophy } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { supabase } from '../lib/supabase'
import { useCollection } from '../lib/useCollection'
import { useRugbyMatches } from '../lib/useRugbyMatches'
import {
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
  const [addingId, setAddingId] = useState(null)
  const [addError, setAddError] = useState('')

  const todayStart = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }, [])
  const upcoming = items.filter((match) => new Date(match.kickoff_at).getTime() >= todayStart)
  const results = items
    .filter((match) => new Date(match.kickoff_at).getTime() < todayStart)
    .reverse()

  const handleSync = async () => {
    if (syncing || !supabase) return
    setSyncing(true)
    setSyncMessage('')
    const { data, error: invokeError } = await supabase.functions.invoke('sync-rugby', {
      body: {},
    })
    if (invokeError || data?.success === false) {
      setSyncMessage(data?.error?.message || 'Kunde inte hämta matcher just nu.')
    } else {
      const extra =
        Array.isArray(data?.warnings) && data.warnings.length > 0
          ? ` ${data.warnings[0]}`
          : ''
      setSyncMessage(
        data?.saved
          ? `${data.saved} matcher uppdaterade.${extra}`
          : `Inga matcher att spara just nu.${extra}`,
      )
      await reload()
    }
    setSyncing(false)
  }

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
      <p className="muted small">Matcher för klubbar nära Pamiers. Carcassonne är inte med.</p>

      <div className="rugby-clubs">
        {RUGBY_CLUBS.map((club) => (
          <span key={club.id} className="rugby-chip">
            {club.short}
            <span className="rugby-chip-league">{club.league}</span>
          </span>
        ))}
      </div>

      {syncMessage && <p className="info">{syncMessage}</p>}
      {addError && <p className="error">{addError}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <Spinner />}

      {!loading && upcoming.length === 0 && results.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Inga matcher ännu"
          description="Tryck på Uppdatera för att hämta matcher från Top 14 och Pro D2."
        />
      )}

      {upcoming.length > 0 && (
        <section className="rugby-section">
          <h2 className="rugby-heading">Kommande</h2>
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
        </section>
      )}

      {results.length > 0 && (
        <section className="rugby-section">
          <h2 className="rugby-heading">Resultat</h2>
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
        </section>
      )}
    </div>
  )
}
