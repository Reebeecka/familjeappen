import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import EmptyState from './EmptyState'
import Spinner from './Spinner'
import './ActivityFeed.css'

const MAX_ACTIVITIES = 20
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉']

function addReaction(current, reaction) {
  if (current.some((item) => item.id === reaction.id)) return current
  return [...current, reaction]
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

export default function ActivityFeed() {
  const { user, householdId } = useAuth()
  const [activities, setActivities] = useState([])
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

      const { data, error: fetchError } = await supabase
        .from('activity')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(MAX_ACTIVITIES)

      if (!active) return

      if (fetchError) {
        setError('Aktivitetsflödet kunde inte laddas.')
      } else {
        setActivities(data ?? [])
        setNow(Date.now())
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
  }, [householdId])

  const activityIds = activities.map((activity) => activity.id).join(',')

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

        setReactions((current) =>
          current.filter((reaction) => reaction.id !== existingReaction.id),
        )
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
      <h2 id="activity-heading" className="activity-heading">
        Familjeväggen
      </h2>

      <div className="card activity-card">
        {householdId && loading && (
          <Spinner label="Laddar aktivitet…" />
        )}
        {error && <p className="error activity-message">{error}</p>}
        {(!householdId || !loading) && !error && activities.length === 0 && (
          <EmptyState
            icon="📣"
            title="Ingen aktivitet än"
            description="Familjens senaste aktivitet visas här."
          />
        )}

        {activities.length > 0 && (
          <ul className="list activity-list">
            {activities.map((activity) => (
              <li className="activity-item" key={activity.id}>
                <p className="activity-text">
                  <strong>{activity.actor_name || 'Någon'}</strong> {activity.action}{' '}
                  {activity.entity}: {activity.summary}
                </p>
                <time className="muted small" dateTime={activity.created_at}>
                  {relativeTime(activity.created_at, now)}
                </time>
                <div className="activity-reactions" aria-label="Reaktioner">
                  {REACTION_EMOJIS.map((emoji) => {
                    const emojiReactions = reactions.filter(
                      (reaction) =>
                        reaction.activity_id === activity.id && reaction.emoji === emoji,
                    )
                    const hasReacted = emojiReactions.some(
                      (reaction) => reaction.user_id === user?.id,
                    )
                    const pendingKey = `${activity.id}-${emoji}`

                    return (
                      <button
                        className={`activity-reaction${hasReacted ? ' active' : ''}`}
                        type="button"
                        key={emoji}
                        aria-label={`${hasReacted ? 'Ta bort' : 'Lägg till'} reaktionen ${emoji}`}
                        aria-pressed={hasReacted}
                        disabled={!user || pendingReactions.has(pendingKey)}
                        onClick={() => toggleReaction(activity.id, emoji)}
                      >
                        <span aria-hidden="true">{emoji}</span>
                        <span>{emojiReactions.length}</span>
                      </button>
                    )
                  })}
                </div>
              </li>
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
