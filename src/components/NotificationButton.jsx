import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { enablePush, isPushEnabled, isPushSupported } from '../lib/push'

export default function NotificationButton() {
  const { user, householdId } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const supported = isPushSupported()

  useEffect(() => {
    if (supported) isPushEnabled().then(setEnabled)
  }, [supported])

  const handleEnable = async () => {
    setError(null)
    setBusy(true)
    try {
      await enablePush({ userId: user.id, householdId })
      setEnabled(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return (
      <div className="card">
        <p className="muted small">Den här enheten stöder inte push-notiser.</p>
      </div>
    )
  }

  if (enabled) {
    return (
      <div className="card notif-card enabled">
        <span>🔔 Notiser är på för den här enheten</span>
      </div>
    )
  }

  return (
    <div className="card notif-card">
      <div>
        <p className="notif-title">🔔 Slå på notiser</p>
        <p className="muted small">Få en notis när din partner lägger till eller slutför något.</p>
      </div>
      <button type="button" className="btn primary" onClick={handleEnable} disabled={busy}>
        {busy ? 'Vänta…' : 'Aktivera'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
