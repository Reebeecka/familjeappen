import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

/**
 * Delad hook för en hushållskopplad tabell med realtidssynk.
 * Hämtar rader, lyssnar på ändringar och ger add/update/remove.
 */
export function useCollection(table, orderBy = 'created_at') {
  const { householdId, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!householdId) return

    let active = true

    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .order(orderBy, { ascending: true })
      if (!active) return
      if (fetchError) setError(fetchError.message)
      else setItems(data ?? [])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`${table}-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setItems((current) => {
            if (payload.eventType === 'INSERT') {
              if (current.some((row) => row.id === payload.new.id)) return current
              return [...current, payload.new]
            }
            if (payload.eventType === 'UPDATE') {
              return current.map((row) => (row.id === payload.new.id ? payload.new : row))
            }
            if (payload.eventType === 'DELETE') {
              return current.filter((row) => row.id !== payload.old.id)
            }
            return current
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [table, orderBy, householdId])

  const add = useCallback(
    async (fields) => {
      const { error: insertError } = await supabase
        .from(table)
        .insert({ ...fields, household_id: householdId, created_by: user?.id })
      if (insertError) setError(insertError.message)
    },
    [table, householdId, user],
  )

  const update = useCallback(
    async (id, fields) => {
      const { error: updateError } = await supabase.from(table).update(fields).eq('id', id)
      if (updateError) setError(updateError.message)
    },
    [table],
  )

  const remove = useCallback(
    async (id) => {
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
      if (deleteError) setError(deleteError.message)
    },
    [table],
  )

  return { items, loading, error, add, update, remove }
}
