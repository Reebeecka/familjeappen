import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

/**
 * Ber om tillåtelse, prenumererar på push och sparar prenumerationen i databasen.
 * Returnerar true om notiser aktiverades.
 */
export async function enablePush({ userId, householdId }) {
  if (!isPushSupported()) {
    throw new Error('Den här enheten stöder inte push-notiser.')
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID-nyckeln saknas (VITE_VAPID_PUBLIC_KEY).')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Du behöver tillåta notiser i webbläsaren.')
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_id: userId,
      household_id: householdId,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)

  return true
}

export async function isPushEnabled() {
  if (!isPushSupported()) return false
  if (Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return Boolean(subscription)
}
