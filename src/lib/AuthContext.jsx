import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    let authEventReceived = false
    let profileRequestId = 0
    let currentSessionKey

    const resolveSession = async (newSession) => {
      const sessionKey = newSession?.access_token ?? null

      setSession(newSession)

      if (sessionKey === currentSessionKey) {
        return
      }

      currentSessionKey = sessionKey
      const requestId = ++profileRequestId
      setProfile(null)
      setProfileError(null)

      if (!newSession?.user) {
        setLoading(false)
        return
      }

      setLoading(true)

      let data = null
      let profileFetchError = null

      try {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newSession.user.id)
          .single()
        data = result.data
        profileFetchError = result.error
      } catch (error) {
        profileFetchError = error
      }

      if (!active || requestId !== profileRequestId) {
        return
      }

      if (profileFetchError) {
        console.error('Kunde inte hämta användarprofil:', profileFetchError)
        setProfile(null)
        setProfileError(profileFetchError)
      } else {
        setProfile(data)
      }

      setLoading(false)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      authEventReceived = true
      void resolveSession(newSession)
    })

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!active || authEventReceived) {
          return
        }

        if (error) {
          console.error('Kunde inte hämta session:', error)
          setLoading(false)
          return
        }

        await resolveSession(data.session)
      } catch (error) {
        if (active && !authEventReceived) {
          console.error('Kunde inte hämta session:', error)
          setLoading(false)
        }
      }
    }

    void initializeSession()

    return () => {
      active = false
      profileRequestId += 1
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (!supabase || !session?.user) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (error) {
      console.error('Kunde inte uppdatera användarprofil:', error)
      return
    }
    setProfile(data)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    householdId: profile?.household_id ?? null,
    loading,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth måste användas inuti en AuthProvider')
  }
  return context
}
