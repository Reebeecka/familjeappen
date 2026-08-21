import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        })
        if (signUpError) throw signUpError
        setInfo('Konto skapat! Om e-postbekräftelse är på: kolla din inkorg. Annars kan du logga in direkt.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message ?? 'Något gick fel. Försök igen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <h1 className="brand">Familjeappen</h1>
        <p className="muted">Vår gemensamma organisatör</p>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            Logga in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => setMode('signup')}
          >
            Skapa konto
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {mode === 'signup' && (
            <label>
              Namn
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ditt namn"
                required
              />
            </label>
          )}
          <label>
            E-post
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@exempel.se"
              required
            />
          </label>
          <label>
            Lösenord
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 6 tecken"
              minLength={6}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}

          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? 'Vänta…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
          </button>
        </form>
      </div>
    </div>
  )
}
