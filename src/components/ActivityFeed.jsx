import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Newspaper } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import EmptyState from './EmptyState'
import Spinner from './Spinner'
import './ActivityFeed.css'

const MAX_ACTIVITIES = 20
const MAX_VISIBLE = 8
const SWIPE_HIDE_PX = 72
const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉']

function addReaction(current, reaction) {
  if (current.some((item) => item.id === reaction.id)) return current
  return [...current, reaction]
}

function activityLink(activity) {
  if (activity.entity_id) return `/listor/${activity.entity_id}`
  const entity = activity.entity ?? ''
  if (entity.includes('händelse')) return '/kalender'
  if (entity.includes('måltid')) return '/maltider'
  return null
}

function relativeTime(createdAt, now) {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))

  if (elapsedSeconds < 60) return 'nyss'

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `för ${elapsedMinutes} min sedan`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `för ${elapsedHours} tim sedan`

  const elapsedDays = Math.floor(elapsedHours / 24)
  return `för ${elapsedDays} ${elapsedDays === 1 ? 'dag' : 'dagar'} sedan`
}

function ActivityRow({ activity, now, reactions, user, pendingReactions, onToggleReaction, onHide }) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(null)
  const offsetRef = useRef(0)
  const swiping = useRef(false)
  const link = activityLink(activity)

  const textContent = (
    <>
      <strong>{activity.actor_name || 'Någon'}</strong> {activity.action} {activity.entity}{' '}
      <strong>{activity.summary}</strong>
    </>
  )

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startX.current = event.clientX
    offsetRef.current = 0
    swiping.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    if (startX.current == null) return
    const dx = event.clientX - startX.current
    if (dx < -10) {
      swiping.current = true
      offsetRef.current = Math.max(dx, -120)
      setOffset(offsetRef.current)
    } else if (!swiping.current) {
      offsetRef.current = 0
      setOffset(0)
    }
  }

  const finishSwipe = () => {
    if (swiping.current && offsetRef.current <= -SWIPE_HIDE_PX) {
      onHide(activity.id)
    } else {
      offsetRef.current = 0
      setOffset(0)
    }
    startX.current = null
    swiping.current = false
  }

  return (
    <li className="activity-item">
      <div className="activity-swipe-hint" aria-hidden="true">
        Göm
      </div>
      <div
        className="activity-swipe-surface"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        {link ? (
          <Link
            to={link}
            className="activity-text activity-link"
            onClick={(event) => {
              if (swiping.current || offset < -8) event.preventDefault()
            }}
          >
            {textContent}
          </Link>
        ) : (
          <p className="activity-text">{textContent}</p>
        )}
        <div className="activity-item-meta">
          <time className="muted small" dateTime={activity.created_at}>
            {relativeTime(activity.created_at, now)}
          </time>
          <button
            type="button"
            className="btn ghost activity-hide"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onHide(activity.id)}
          >
            Göm
          </button>
        </div>
        <div
          className="activity-reactions"
          aria-label="Reaktioner"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {REACTION_EMOJIS.map((emoji) => {
            const emojiReactions = reactions.filter(
              (reaction) => reaction.activity_id === activity.id && reaction.emoji === emoji,
            )
            const hasReacted = emojiReactions.some((reaction) => reaction.user_id === user?.id)
            const pendingKey = `${activity.id}-${emoji}`

            return (
              <button
                className={`activity-reaction${hasReacted ? ' active' : ''}`}
                type="button"
                key={emoji}
                aria-label={`${hasReacted ? 'Ta bort' : 'Lägg till'} reaktionen ${emoji}`}
                aria-pressed={hasReacted}
                disabled={!user || pendingReactions.has(pendingKey)}
                onClick={() => onToggleReaction(activity.id, emoji)}
              >
                <span aria-hidden="true">{emoji}</span>
                {emojiReactions.length > 0 ? <span>{emojiReactions.length}</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    </li>
  )
}

export default function ActivityFeed() {
  const { user, householdId } = useAuth()
  const [activities, setActivities] = useState([])
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [reactions, setReactions] = useState([])
  const [pendingReactions, setPendingReactions] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reactionError, setReactionError] = useState(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!householdId || !supabase) return

    let active = true

    const loadActivities = async () => {
      setLoading(true)
      setError(null)

      const [activityResult, hiddenResult] = await Promise.all([
        supabase
          .from('activity')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(MAX_ACTIVITIES),
        user
          ? supabase.from('activity_hidden').select('activity_id').eq('user_id', user.id)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (!active) return

      if (activityResult.error) {
        setError('Aktivitetsflödet kunde inte laddas.')
      } else {
        setActivities(activityResult.data ?? [])
        setNow(Date.now())
      }

      if (!hiddenResult.error) {
        setHiddenIds(new Set((hiddenResult.data ?? []).map((row) => row.activity_id)))
      }
      setLoading(false)
    }

    loadActivities()

    const channelName = `activity-${householdId}-${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setNow(Date.now())
          setActivities((current) => {
            if (current.some((activity) => activity.id === payload.new.id)) return current
            return [payload.new, ...current].slice(0, MAX_ACTIVITIES)
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId, user])

  const visibleActivities = activities
    .filter((activity) => !hiddenIds.has(activity.id))
    .slice(0, MAX_VISIBLE)
  const activityIds = visibleActivities.map((activity) => activity.id).join(',')

  useEffect(() => {
    if (!householdId || !supabase || !activityIds) {
      setReactions([])
      return
    }

    let active = true

    const loadReactions = async () => {
      const { data, error: fetchError } = await supabase
        .from('activity_reactions')
        .select('*')
        .eq('household_id', householdId)
        .in('activity_id', activityIds.split(','))

      if (!active) return

      if (fetchError) {
        setReactionError('Reaktionerna kunde inte laddas.')
      } else {
        setReactions(data ?? [])
        setReactionError(null)
      }
    }

    loadReactions()

    return () => {
      active = false
    }
  }, [activityIds, householdId])

  useEffect(() => {
    if (!householdId || !supabase) return

    const channelName = `activity-reactions-${householdId}-${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_reactions',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setReactions((current) => addReaction(current, payload.new))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'activity_reactions',
        },
        (payload) => {
          setReactions((current) => current.filter((reaction) => reaction.id !== payload.old.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId])

  const hideActivity = async (activityId) => {
    if (!user || !householdId || !supabase) return

    setHiddenIds((current) => {
      const next = new Set(current)
      next.add(activityId)
      return next
    })

    const { error: hideError } = await supabase.from('activity_hidden').insert({
      user_id: user.id,
      activity_id: activityId,
      household_id: householdId,
    })

    if (hideError && hideError.code !== '23505') {
      setHiddenIds((current) => {
        const next = new Set(current)
        next.delete(activityId)
        return next
      })
      setError('Kunde inte gömma inlägget. Försök igen.')
    }
  }

  const toggleReaction = async (activityId, emoji) => {
    if (!user || !householdId || !supabase) return

    const pendingKey = `${activityId}-${emoji}`
    if (pendingReactions.has(pendingKey)) return

    setPendingReactions((current) => new Set(current).add(pendingKey))
    setReactionError(null)

    const existingReaction = reactions.find(
      (reaction) =>
        reaction.activity_id === activityId &&
        reaction.user_id === user.id &&
        reaction.emoji === emoji,
    )

    try {
      if (existingReaction) {
        const { error: deleteError } = await supabase
          .from('activity_reactions')
          .delete()
          .eq('id', existingReaction.id)

        if (deleteError) throw deleteError

        setReactions((current) => current.filter((reaction) => reaction.id !== existingReaction.id))
      } else {
        const { data, error: insertError } = await supabase
          .from('activity_reactions')
          .insert({
            activity_id: activityId,
            household_id: householdId,
            user_id: user.id,
            emoji,
          })
          .select()
          .single()

        if (insertError) throw insertError

        setReactions((current) => addReaction(current, data))
      }
    } catch {
      setReactionError('Reaktionen kunde inte sparas. Försök igen.')
    } finally {
      setPendingReactions((current) => {
        const next = new Set(current)
        next.delete(pendingKey)
        return next
      })
    }
  }

  return (
    <section className="activity-section" aria-labelledby="activity-heading">
      <div className="activity-heading-row">
        <h2 id="activity-heading" className="activity-heading">
          Familjeväggen
        </h2>
        <p className="muted small activity-hint">Svep vänster för att gömma</p>
      </div>

      <div className="card activity-card">
        {householdId && loading && <Spinner label="Laddar aktivitet…" />}
        {error && <p className="error activity-message">{error}</p>}
        {(!householdId || !loading) && !error && visibleActivities.length === 0 && (
          <EmptyState
            icon={Newspaper}
            title="Ingen aktivitet än"
            description="Familjens senaste aktivitet visas här."
          />
        )}

        {visibleActivities.length > 0 && (
          <ul className="list activity-list">
            {visibleActivities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                now={now}
                reactions={reactions}
                user={user}
                pendingReactions={pendingReactions}
                onToggleReaction={toggleReaction}
                onHide={hideActivity}
              />
            ))}
          </ul>
        )}
        {reactionError && (
          <p className="error activity-reaction-error" role="status">
            {reactionError}
          </p>
        )}
      </div>
    </section>
  )
}
