import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

export function useRugbyMatches(fromIso, toIso) {
  const { householdId } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!householdId || !supabase) return

    setLoading(true)
    let query = supabase
      .from('rugby_matches')
      .select('*')
      .order('kickoff_at', { ascending: true })
      .limit(300)

    if (fromIso) query = query.gte('kickoff_at', fromIso)
    if (toIso) query = query.lte('kickoff_at', toIso)

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
      setItems([])
    } else {
      setError(null)
      setItems(data ?? [])
    }
    setLoading(false)
  }, [householdId, fromIso, toIso])

  useEffect(() => {
    if (!householdId || !supabase) return

    let active = true
    load()

    const channel = supabase
      .channel(`rugby-matches-${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rugby_matches' },
        () => {
          if (active) load()
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId, load])

  return { items, loading: Boolean(householdId && supabase) && loading, error, reload: load }
}
