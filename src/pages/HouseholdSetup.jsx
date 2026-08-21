import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HouseholdSetup() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const reload = () => window.location.reload()

  const createHousehold = async (event) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error: rpcError } = await supabase.rpc('create_household', {
        p_name: name || 'Vårt hushåll',
      })
      if (rpcError) throw rpcError
      reload()
    } catch (err) {
      setError(err.message ?? 'Kunde inte skapa hushåll.')
      setBusy(false)
    }
  }

  const joinHousehold = async (event) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error: rpcError } = await supabase.rpc('join_household', {
        p_code: code.trim().toUpperCase(),
      })
      if (rpcError) throw rpcError
      reload()
    } catch (err) {
      setError(err.message ?? 'Kunde inte gå med. Kontrollera koden.')
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <div className="card setup-card">
        <h1>Koppla ihop er 👫</h1>
        <p className="muted">
          En av er skapar ett hushåll och delar koden. Den andra går med via koden. Sen delar ni allt.
        </p>

        <form onSubmit={createHousehold} className="form">
          <h2>Skapa nytt hushåll</h2>
          <label>
            Namn på hushållet
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Familjen Larsson"
            />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            Skapa hushåll
          </button>
        </form>

        <div className="divider">eller</div>

        <form onSubmit={joinHousehold} className="form">
          <h2>Gå med i befintligt hushåll</h2>
          <label>
            Inbjudningskod
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="T.ex. ABC123"
            />
          </label>
          <button type="submit" className="btn secondary" disabled={busy}>
            Gå med
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
