import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'

// Returnerar { members, loading }
// members: array av { id, display_name, color, avatar }
export function useHouseholdMembers() {
  const { householdId } = useAuth()
  const [result, setResult] = useState({ householdId: null, members: [] })

  useEffect(() => {
    if (!householdId) return

    let active = true

    const loadMembers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, color, avatar')
        .eq('household_id', householdId)

      if (!active) return
      setResult({ householdId, members: data ?? [] })
    }

    loadMembers()

    return () => {
      active = false
    }
  }, [householdId])

  const hasLoadedHousehold = result.householdId === householdId

  return {
    members: hasLoadedHousehold ? result.members : [],
    loading: Boolean(householdId && !hasLoadedHousehold),
  }
}
