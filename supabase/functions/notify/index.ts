// Supabase Edge Function: skickar push-notiser när tasks/shopping_items ändras.
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

function buildMessage(payload: WebhookPayload, actorName: string): { body: string } | null {
  const { type, table, record, old_record } = payload
  if (!record) return null

  if (table === 'tasks') {
    const title = record.title as string
    if (type === 'INSERT') return { body: `${actorName} la till uppgift: ${title}` }
    if (type === 'UPDATE' && old_record && !old_record.done && record.done) {
      return { body: `${actorName} slutförde: ${title}` }
    }
  }

  if (table === 'shopping_items') {
    const name = record.name as string
    if (type === 'INSERT') return { body: `${actorName} la till på inköpslistan: ${name}` }
    if (type === 'UPDATE' && old_record && !old_record.checked && record.checked) {
      return { body: `${actorName} bockade av: ${name}` }
    }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = (await req.json()) as WebhookPayload
  const record = payload.record
  if (!record) return new Response('ok', { status: 200 })

  const householdId = record.household_id as string
  const actorId = (record.updated_by ?? record.created_by) as string | null

  // Hämta avsändarens namn.
  let actorName = 'Någon'
  if (actorId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', actorId)
      .single()
    if (profile?.display_name) actorName = profile.display_name
  }

  const message = buildMessage(payload, actorName)
  if (!message) return new Response('ingen notis behövs', { status: 200 })

  // Hämta hushållets prenumerationer, utom avsändarens egna enheter.
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', householdId)
    .neq('user_id', actorId ?? '')

  if (!subs || subs.length === 0) return new Response('inga mottagare', { status: 200 })

  const notification = JSON.stringify({
    title: 'Familjeappen',
    body: message.body,
    url: '/',
  })

  await Promise.all(
    subs.map(async (sub) => {
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
        }
      }
    }),
  )

  return new Response('skickat', { status: 200 })
})
