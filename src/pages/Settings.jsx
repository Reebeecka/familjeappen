import { useEffect, useRef, useState } from 'react'
import { Users } from 'lucide-react'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import NotificationButton from '../components/NotificationButton'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useHouseholdMembers } from '../lib/useHouseholdMembers'
import './Settings.css'

const DEFAULT_NOTIFICATION_PREFS = {
  notify_tasks: true,
  notify_shopping: true,
  notify_calendar: true,
  notify_chat: true,
}

const NOTIFICATION_OPTIONS = [
  {
    key: 'notify_tasks',
    label: 'Uppgifter',
    description: 'När någon lägger till eller slutför en uppgift.',
  },
  {
    key: 'notify_shopping',
    label: 'Inköpslistor',
    description: 'När inköpslistan ändras.',
  },
  {
    key: 'notify_calendar',
    label: 'Kalender',
    description: 'När en kalenderhändelse läggs till eller ändras.',
  },
  {
    key: 'notify_chat',
    label: 'Chatt',
    description: 'När du får ett nytt meddelande.',
  },
]

const THEME_OPTIONS = [
  { value: 'light', label: 'Ljust' },
  { value: 'dark', label: 'Mörkt' },
  { value: 'system', label: 'System' },
]

function getSavedTheme() {
  const savedTheme = localStorage.getItem('theme')
  return THEME_OPTIONS.some((option) => option.value === savedTheme) ? savedTheme : 'system'
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
    return
  }

  document.documentElement.setAttribute('data-theme', theme)
}

export default function Settings() {
  const { user, profile, householdId } = useAuth()
  const { members, loading: membersLoading } = useHouseholdMembers()
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [savingPreference, setSavingPreference] = useState(null)
  const [prefsError, setPrefsError] = useState('')
  const [household, setHousehold] = useState(null)
  const [householdLoading, setHouseholdLoading] = useState(true)
  const [householdError, setHouseholdError] = useState('')
  const [theme, setTheme] = useState(getSavedTheme)
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeError, setThemeError] = useState('')
  const [saveStatus, setSaveStatus] = useState({ section: null, state: '' })
  const savingOperationRef = useRef(false)
  const statusTimerRef = useRef(null)

  useEffect(
    () => () => {
      window.clearTimeout(statusTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!user) return

    let active = true

    const loadNotificationPrefs = async () => {
      setPrefsLoading(true)
      setPrefsError('')

      const { data, error } = await supabase
        .from('notification_prefs')
        .select('notify_tasks, notify_shopping, notify_calendar, notify_chat')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        setPrefsError('Notisinställningarna kunde inte laddas.')
      } else if (data) {
        setNotificationPrefs(data)
      }
      setPrefsLoading(false)
    }

    loadNotificationPrefs()

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!householdId) return

    let active = true

    const loadHousehold = async () => {
      setHouseholdLoading(true)
      setHouseholdError('')

      const { data, error } = await supabase
        .from('households')
        .select('name, invite_code')
        .eq('id', householdId)
        .single()

      if (!active) return

      if (error) {
        setHouseholdError('Inbjudningskoden kunde inte laddas.')
      } else {
        setHousehold(data)
      }
      setHouseholdLoading(false)
    }

    loadHousehold()

    return () => {
      active = false
    }
  }, [householdId])

  const showSavedStatus = (section) => {
    window.clearTimeout(statusTimerRef.current)
    setSaveStatus({ section, state: 'saved' })
    statusTimerRef.current = window.setTimeout(() => {
      setSaveStatus({ section: null, state: '' })
    }, 2000)
  }

  const handlePreferenceChange = async (key) => {
    if (!user || !householdId || savingOperationRef.current) return

    const updatedPrefs = {
      ...notificationPrefs,
      [key]: !notificationPrefs[key],
    }

    savingOperationRef.current = true
    window.clearTimeout(statusTimerRef.current)
    setSavingPreference(key)
    setPrefsError('')
    setSaveStatus({ section: 'notifications', state: 'saving' })

    try {
      const { error } = await supabase.from('notification_prefs').upsert({
        user_id: user.id,
        household_id: householdId,
        ...updatedPrefs,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        setSaveStatus({ section: null, state: '' })
        setPrefsError('Inställningen kunde inte sparas. Försök igen.')
      } else {
        setNotificationPrefs(updatedPrefs)
        showSavedStatus('notifications')
      }
    } catch {
      setSaveStatus({ section: null, state: '' })
      setPrefsError('Inställningen kunde inte sparas. Försök igen.')
    } finally {
      savingOperationRef.current = false
      setSavingPreference(null)
    }
  }

  const handleThemeChange = async (nextTheme) => {
    if (nextTheme === theme || savingOperationRef.current) return

    savingOperationRef.current = true
    window.clearTimeout(statusTimerRef.current)
    setThemeSaving(true)
    setThemeError('')
    setSaveStatus({ section: 'theme', state: 'saving' })

    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      localStorage.setItem('theme', nextTheme)
      applyTheme(nextTheme)
      setTheme(nextTheme)
      showSavedStatus('theme')
    } catch {
      setSaveStatus({ section: null, state: '' })
      setThemeError('Temat kunde inte sparas. Försök igen.')
    } finally {
      savingOperationRef.current = false
      setThemeSaving(false)
    }
  }

  return (
    <div className="page settings-page">
      <h1 className="page-title">Inställningar ⚙️</h1>

      <section className="settings-section" aria-labelledby="notifications-heading">
        <div className="settings-section-heading">
          <h2 id="notifications-heading">Notiser</h2>
          <p className="muted small">Välj vilka händelser du vill få notiser om.</p>
        </div>

        <NotificationButton />

        <div className="card settings-card">
          {prefsLoading ? (
            <Spinner />
          ) : (
            <div className="preference-list">
              {NOTIFICATION_OPTIONS.map((option) => (
                <label className="preference-row" key={option.key}>
                  <span>
                    <span className="preference-label">{option.label}</span>
                    <span className="muted small preference-description">{option.description}</span>
                  </span>
                  <input
                    className="switch-input"
                    type="checkbox"
                    checked={notificationPrefs[option.key]}
                    onChange={() => handlePreferenceChange(option.key)}
                    disabled={Boolean(savingPreference) || themeSaving || !householdId}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </label>
              ))}
            </div>
          )}
          {prefsError && (
            <p className="error settings-message" role="alert">
              {prefsError}
            </p>
          )}
          {saveStatus.section === 'notifications' && (
            <p className="info settings-message" role="status">
              {saveStatus.state === 'saving' ? 'Sparar…' : 'Sparat'}
            </p>
          )}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="household-heading">
        <div className="settings-section-heading">
          <h2 id="household-heading">Hushållsmedlemmar</h2>
          <p className="muted small">Alla som är med i ert hushåll.</p>
        </div>

        <div className="card settings-card">
          {membersLoading ? (
            <Spinner />
          ) : (
            <ul className="member-list">
              {members.map((member) => (
                <li className="member-row" key={member.id}>
                  <Avatar profile={member} size={40} />
                  <span className="member-name">
                    {member.display_name || 'Namnlös medlem'}
                    {member.id === profile?.id && <span className="muted small"> (du)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!membersLoading && members.length === 0 && (
            <EmptyState
              icon={Users}
              title="Inga medlemmar"
              description="Inga hushållsmedlemmar hittades."
            />
          )}
        </div>

        <div className="card invite-card settings-invite-card">
          {householdLoading && <Spinner />}
          {householdError && (
            <p className="error settings-message" role="alert">
              {householdError}
            </p>
          )}
          {!householdLoading && household && (
            <>
              <p className="household-name">{household.name}</p>
              <p className="muted small">Bjud in fler familjemedlemmar med koden</p>
              <p className="invite-code">{household.invite_code}</p>
            </>
          )}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="theme-heading">
        <div className="settings-section-heading">
          <h2 id="theme-heading">Tema</h2>
          <p className="muted small">Välj hur appen ska se ut på den här enheten.</p>
        </div>

        <div className="card settings-card">
          <div className="theme-selector" role="group" aria-label="Välj tema">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={theme === option.value ? 'theme-option active' : 'theme-option'}
                onClick={() => handleThemeChange(option.value)}
                aria-pressed={theme === option.value}
                disabled={themeSaving || Boolean(savingPreference)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {themeError && (
            <p className="error settings-message" role="alert">
              {themeError}
            </p>
          )}
          {saveStatus.section === 'theme' && (
            <p className="info settings-message" role="status">
              {saveStatus.state === 'saving' ? 'Sparar…' : 'Sparat'}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
