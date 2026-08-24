import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useHouseholdMembers } from '../lib/useHouseholdMembers'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import './Chat.css'

const MESSAGE_LIMIT = 50

function formatMessageTime(createdAt, now) {
  const date = new Date(createdAt)
  const elapsedSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000))

  if (elapsedSeconds < 60) return 'nyss'

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} min sedan`

  const isToday = date.toDateString() === new Date(now).toDateString()
  if (isToday) {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  }

  return date.toLocaleString('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Chat() {
  const { user, profile, householdId } = useAuth()
  const { members } = useHouseholdMembers()
  const [result, setResult] = useState({ householdId: null, messages: [] })
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [errorResult, setErrorResult] = useState({ householdId: null, message: null })
  const [now, setNow] = useState(0)
  const messagesEndRef = useRef(null)
  const sendingRef = useRef(false)

  const messages = result.householdId === householdId ? result.messages : []
  const loading = Boolean(householdId && supabase && result.householdId !== householdId)
  const error = errorResult.householdId === householdId ? errorResult.message : null

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!householdId || !supabase) return

    let active = true

    const channelName = `messages-${householdId}-${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setNow(Date.now())
          setResult((current) => {
            const currentMessages =
              current.householdId === householdId ? current.messages : []
            if (currentMessages.some((message) => message.id === payload.new.id)) {
              return current
            }
            return {
              householdId,
              messages: [...currentMessages, payload.new].slice(-MESSAGE_LIMIT),
            }
          })
        },
      )
      .subscribe()

    const loadMessages = async () => {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('id, household_id, sender_id, body, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT)

      if (!active) return

      if (fetchError) {
        setErrorResult({
          householdId,
          message: 'Chatten kunde inte laddas. Försök igen senare.',
        })
        setResult((current) => ({
          householdId,
          messages: current.householdId === householdId ? current.messages : [],
        }))
      } else {
        setErrorResult({ householdId, message: null })
        setResult((current) => {
          const loaded = [...(data ?? [])].reverse()
          const loadedIds = new Set(loaded.map((message) => message.id))
          const currentMessages =
            current.householdId === householdId ? current.messages : []
          const receivedWhileLoading = currentMessages.filter(
            (message) => !loadedIds.has(message.id),
          )
          return {
            householdId,
            messages: [...loaded, ...receivedWhileLoading].slice(-MESSAGE_LIMIT),
          }
        })
        setNow(Date.now())
      }
    }

    loadMessages()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [result])

  const sendMessage = async (event) => {
    event.preventDefault()

    const trimmedBody = body.trim()
    if (!trimmedBody || !householdId || !user || !supabase || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    setErrorResult({ householdId, message: null })

    try {
      const { error: insertError } = await supabase.from('messages').insert({
        household_id: householdId,
        sender_id: user.id,
        body: trimmedBody,
      })

      if (insertError) {
        setErrorResult({
          householdId,
          message: 'Meddelandet kunde inte skickas. Försök igen.',
        })
      } else {
        setBody('')
      }
    } catch {
      setErrorResult({
        householdId,
        message: 'Meddelandet kunde inte skickas. Försök igen.',
      })
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <div className="page chat-page">
      <header>
        <h1 className="page-title">Chatt</h1>
        <p className="muted chat-intro">Prata med hela familjen på samma ställe.</p>
      </header>

      <section className="card chat-card" aria-label="Familjechatt">
        <div className="chat-messages" aria-live="polite">
          {loading && <Spinner label="Laddar meddelanden…" />}
          {!loading && error && messages.length === 0 && (
            <p className="error chat-status">{error}</p>
          )}
          {!loading && !error && messages.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="Inga meddelanden än"
              description="Skriv det första meddelandet till familjen."
            />
          )}

          {messages.map((message) => {
            const isOwnMessage = message.sender_id === user?.id
            const sender = membersById.get(message.sender_id)
            const senderName = isOwnMessage
              ? profile?.display_name || sender?.display_name || 'Du'
              : sender?.display_name || 'Familjemedlem'

            return (
              <article
                className={`chat-message${isOwnMessage ? ' own' : ''}`}
                key={message.id}
              >
                <div className="chat-message-meta">
                  <Avatar profile={isOwnMessage ? profile ?? sender : sender} size={22} />
                  <span
                    className="chat-sender"
                    style={sender?.color ? { color: sender.color } : undefined}
                  >
                    {senderName}
                  </span>
                  <time dateTime={message.created_at}>
                    {formatMessageTime(message.created_at, now)}
                  </time>
                </div>
                <p className="chat-bubble">{message.body}</p>
              </article>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {error && messages.length > 0 && <p className="error chat-send-error">{error}</p>}

        <form className="chat-form" onSubmit={sendMessage}>
          <label className="chat-input-label" htmlFor="chat-message">
            Meddelande
          </label>
          <div className="chat-compose">
            <input
              id="chat-message"
              type="text"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Skriv ett meddelande…"
              autoComplete="off"
              disabled={!householdId || sending}
            />
            <button
              className="btn primary"
              type="submit"
              disabled={!body.trim() || !householdId || sending}
            >
              {sending ? 'Skickar…' : 'Skicka'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
