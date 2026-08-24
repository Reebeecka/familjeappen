import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import './Profile.css'

const COLORS = ['#557565', '#a95743', '#d09a45', '#6b7fa3', '#8a6f91', '#4f8b87']
const AVATARS = ['🌻', '🌷', '⭐️', '🦊', '🐼', '🐻', '🌈', '❤️']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()

  if (!profile) {
    return (
      <div className="page">
        <h1 className="page-title">Min profil</h1>
        <Spinner />
      </div>
    )
  }

  return (
    <ProfileForm key={profile.id} user={user} profile={profile} refreshProfile={refreshProfile} />
  )
}

function ProfileForm({ user, profile, refreshProfile }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [color, setColor] = useState(profile.color ?? COLORS[0])
  const [avatar, setAvatar] = useState(profile.avatar ?? AVATARS[0])
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const savingRef = useRef(false)
  const fileInputRef = useRef(null)

  const previewProfile = {
    display_name: displayName,
    color,
    avatar,
    avatar_url: avatarUrl,
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setConfirmation('')

    if (!file.type.startsWith('image/')) {
      setError('Välj en bildfil.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Bilden är för stor (max 5 MB).')
      return
    }

    setUploading(true)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        setError('Bilden kunde inte laddas upp. Försök igen.')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) {
        setError('Bilden kunde inte sparas. Försök igen.')
        return
      }

      setAvatarUrl(publicUrl)
      await refreshProfile()
      setConfirmation('Profilbild sparad')
    } catch {
      setError('Bilden kunde inte laddas upp. Försök igen.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    setError('')
    setConfirmation('')
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)

      if (updateError) {
        setError('Bilden kunde inte tas bort. Försök igen.')
        return
      }
      setAvatarUrl(null)
      await refreshProfile()
      setConfirmation('Profilbild borttagen')
    } finally {
      setSaving(false)
    }
  }

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

    savingRef.current = true
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: trimmedName,
          color,
          avatar: trimmedAvatar || null,
        })
        .eq('id', user.id)

      if (updateError) {
        setError('Profilen kunde inte sparas. Försök igen.')
        return
      }

      setDisplayName(trimmedName)
      setAvatar(trimmedAvatar)
      await refreshProfile()
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
      <h1 className="page-title">Min profil</h1>

      <form className="card form profile-form" onSubmit={handleSubmit} aria-busy={saving}>
        <div className="profile-preview">
          <Avatar profile={previewProfile} size={72} />
          <div>
            <p className="profile-preview-name">{displayName.trim() || 'Ditt namn'}</p>
            <p className="muted small">
              {avatarUrl ? 'Din profilbild används' : 'Ingen bild – emoji eller initialer visas'}
            </p>
          </div>
        </div>

        <div className="profile-photo-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            className="btn ghost profile-photo-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
            {uploading ? 'Laddar upp…' : avatarUrl ? 'Byt profilbild' : 'Ladda upp bild'}
          </button>
          {avatarUrl && (
            <button
              type="button"
              className="btn ghost profile-photo-remove"
              onClick={handleRemovePhoto}
              disabled={saving || uploading}
            >
              <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
              Ta bort bild
            </button>
          )}
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
          <legend>Symbol (visas när du inte har någon bild)</legend>
          <div className="avatar-options">
            {AVATARS.map((option) => (
              <button
                key={option}
                type="button"
                className={avatar === option ? 'avatar-option selected' : 'avatar-option'}
                onClick={() => setAvatar(option)}
                aria-label={`Välj ${option} som symbol`}
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
