// Supabase Edge Function: skickar push-notiser från hushållets listor och chatt.
// Triggas av en Database Webhook (se NOTISER.md).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
const webhookSecret = Deno.env.get('WEBHOOK_SECRET')!
const contactEmail = Deno.env.get('VAPID_CONTACT') ?? 'mailto:familj@example.com'

webpush.setVapidDetails(contactEmail, vapidPublic, vapidPrivate)

const admin = createClient(supabaseUrl, serviceRoleKey)

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

type NotificationCategory = 'tasks' | 'shopping' | 'chat'

interface NotificationMessage {
  body: string
  category: NotificationCategory
}

const preferenceColumns: Record<NotificationCategory, string> = {
  tasks: 'notify_tasks',
  shopping: 'notify_shopping',
  chat: 'notify_chat',
}

function truncateMessage(body: string, maxLength = 80): string {
  const normalizedBody = body.replace(/\s+/g, ' ').trim()
  if (normalizedBody.length <= maxLength) return normalizedBody
  return `${normalizedBody.slice(0, maxLength - 1).trimEnd()}…`
}

function buildMessage(
  payload: WebhookPayload,
  actorName: string,
): NotificationMessage | null {
  const { type, table, record, old_record } = payload
  if (!record) return null

  if (table === 'list_items') {
    const title = record.title as string
    if (type === 'INSERT') {
      return { body: `${actorName} – La till i lista: ${title}`, category: 'tasks' }
    }
    if (type === 'UPDATE' && old_record && !old_record.done && record.done === true) {
      return { body: `${actorName} – Klarade: ${title}`, category: 'tasks' }
    }
  }

  if (table === 'messages' && type === 'INSERT') {
    const body = truncateMessage(record.body as string)
    return { body: `${actorName} – Nytt meddelande: ${body}`, category: 'chat' }
  }

  // Bakåtkompatibilitet för äldre webhooks.
  if (table === 'tasks') {
    const title = record.title as string
    if (type === 'INSERT') {
      return { body: `${actorName} la till uppgift: ${title}`, category: 'tasks' }
    }
    if (type === 'UPDATE' && old_record && !old_record.done && record.done) {
      return { body: `${actorName} slutförde: ${title}`, category: 'tasks' }
    }
  }

  if (table === 'shopping_items') {
    const name = record.name as string
    if (type === 'INSERT') {
      return {
        body: `${actorName} la till på inköpslistan: ${name}`,
        category: 'shopping',
      }
    }
    if (type === 'UPDATE' && old_record && !old_record.checked && record.checked) {
      return { body: `${actorName} bockade av: ${name}`, category: 'shopping' }
    }
  }

  return null
}

function getActorId(table: string, record: Record<string, unknown>): string | null {
  if (table === 'messages') return (record.sender_id as string | null) ?? null
  return ((record.updated_by ?? record.created_by) as string | null) ?? null
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = (await req.json()) as WebhookPayload
  const record = payload.record
  if (!record) return new Response('ok', { status: 200 })

  const householdId = record.household_id as string
  const actorId = getActorId(payload.table, record)

  // Hämta avsändarens namn.
  let actorName = 'Någon'
  if (actorId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', actorId)
      .single()
    if (profile?.display_name) actorName = profile.display_name
  } else if (payload.table === 'list_items' && payload.type === 'INSERT') {
    actorName = 'Återkommande'
  }

  const message = buildMessage(payload, actorName)
  if (!message) return new Response('ingen notis behövs', { status: 200 })

  // Hämta hushållets prenumerationer, utom avsändarens egna enheter.
  let subscriptionsQuery = admin
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', householdId)

  if (actorId) subscriptionsQuery = subscriptionsQuery.neq('user_id', actorId)

  const { data: subs, error: subscriptionsError } = await subscriptionsQuery

  if (subscriptionsError) {
    console.error('Kunde inte hämta push-prenumerationer', subscriptionsError)
    return new Response('kunde inte hämta mottagare', { status: 500 })
  }

  if (!subs || subs.length === 0) return new Response('inga mottagare', { status: 200 })

  const recipientIds = [...new Set(subs.map((sub) => sub.user_id as string))]
  const preferenceColumn = preferenceColumns[message.category]
  const { data: preferences, error: preferencesError } = await admin
    .from('notification_prefs')
    .select(`user_id, ${preferenceColumn}`)
    .eq('household_id', householdId)
    .in('user_id', recipientIds)

  if (preferencesError) {
    console.error('Kunde inte hämta notisinställningar', preferencesError)
    return new Response('kunde inte hämta notisinställningar', { status: 500 })
  }

  const disabledRecipientIds = new Set(
    (preferences ?? [])
      .filter((preference) => preference[preferenceColumn] === false)
      .map((preference) => preference.user_id as string),
  )
  const enabledSubs = subs.filter((sub) => !disabledRecipientIds.has(sub.user_id as string))

  if (enabledSubs.length === 0) {
    return new Response('inga mottagare med notiser aktiverade', { status: 200 })
  }

  const notification = JSON.stringify({
    title: 'Familjeappen',
    body: message.body,
    url: '/',
  })

  await Promise.all(
    enabledSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
      } catch (err) {
        // 404/410 = prenumerationen är död -> ta bort den.
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('Kunde inte skicka push-notis', err)
        }
      }
    }),
  )

  return new Response('skickat', { status: 200 })
})
