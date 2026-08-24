import { useRef, useState } from 'react'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import './Profile.css'

const COLORS = ['#557565', '#a95743', '#d09a45', '#6b7fa3', '#8a6f91', '#4f8b87']
const AVATARS = ['😊', '🥰', '😎', '🤓', '🌻', '🐻', '🦊', '🐼']

export default function Profile() {
  const { user, profile } = useAuth()

  if (!profile) {
    return (
      <div className="page">
        <h1 className="page-title">Min profil 👤</h1>
        <Spinner />
      </div>
    )
  }

  return <ProfileForm key={profile.id} user={user} profile={profile} />
}

function ProfileForm({ user, profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [color, setColor] = useState(profile.color ?? COLORS[0])
  const [avatar, setAvatar] = useState(profile.avatar ?? AVATARS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const savingRef = useRef(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (savingRef.current) return

    const trimmedName = displayName.trim()
    const trimmedAvatar = avatar.trim()

    setError('')
    setConfirmation('')

    if (!trimmedName) {
      setError('Fyll i ett namn.')
      return
    }

    if (!trimmedAvatar) {
      setError('Välj en avatar eller skriv korta initialer.')
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: trimmedName,
          color,
          avatar: trimmedAvatar,
        })
        .eq('id', user.id)

      if (updateError) {
        setError('Profilen kunde inte sparas. Försök igen.')
        return
      }

      setDisplayName(trimmedName)
      setAvatar(trimmedAvatar)
      setConfirmation('Sparat')
    } catch {
      setError('Profilen kunde inte sparas. Försök igen.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Min profil 👤</h1>

      <form className="card form profile-form" onSubmit={handleSubmit} aria-busy={saving}>
        <div className="profile-preview" style={{ '--profile-color': color }}>
          <span className="profile-avatar" aria-hidden="true">
            {avatar || '👤'}
          </span>
          <div>
            <p className="profile-preview-name">{displayName.trim() || 'Ditt namn'}</p>
            <p className="muted small">Så här ser din profil ut</p>
          </div>
        </div>

        <label>
          Visningsnamn
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Ditt namn"
            autoComplete="name"
            maxLength={80}
          />
        </label>

        <fieldset className="profile-fieldset">
          <legend>Profilfärg</legend>
          <div className="color-palette">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={color === option ? 'color-option selected' : 'color-option'}
                style={{ '--option-color': option }}
                onClick={() => setColor(option)}
                aria-label={`Välj profilfärg ${option}`}
                aria-pressed={color === option}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="profile-fieldset">
          <legend>Avatar</legend>
          <div className="avatar-options">
            {AVATARS.map((option) => (
              <button
                key={option}
                type="button"
                className={avatar === option ? 'avatar-option selected' : 'avatar-option'}
                onClick={() => setAvatar(option)}
                aria-label={`Välj ${option} som avatar`}
                aria-pressed={avatar === option}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <label>
          Egen emoji eller initialer
          <input
            type="text"
            value={avatar}
            onChange={(event) => setAvatar(event.target.value)}
            placeholder="Till exempel 🌸 eller RL"
            maxLength={4}
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {confirmation && (
          <p className="info" role="status">
            {confirmation}
          </p>
        )}

        <button type="submit" className="btn primary" disabled={saving || !user}>
          {saving ? 'Sparar…' : 'Spara profil'}
        </button>
      </form>
    </div>
  )
}
