import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'

function getToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function isListItemOverdue(item) {
  return Boolean(item.due_date && item.due_date < getToday() && !item.done)
}

export function sortListItems(items) {
  return [...items].sort((first, second) => {
    const overdueDifference =
      Number(isListItemOverdue(second)) - Number(isListItemOverdue(first))
    if (overdueDifference) return overdueDifference

    const highPriorityDifference =
      Number(second.priority === 'hög') - Number(first.priority === 'hög')
    if (highPriorityDifference) return highPriorityDifference

    const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER
    const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER
    if (firstPosition !== secondPosition) return firstPosition - secondPosition
    return new Date(first.created_at) - new Date(second.created_at)
  })
}

export function useListItems(listId) {
  const { householdId, user } = useAuth()
  const scopeKey = householdId && listId ? `${householdId}:${listId}` : null
  const [result, setResult] = useState({
    scopeKey: null,
    items: [],
    error: null,
  })

  useEffect(() => {
    if (!scopeKey) return

    let active = true

    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (!active) return
      setResult({
        scopeKey,
        items: fetchError ? [] : sortListItems(data ?? []),
        error: fetchError?.message ?? null,
      })
    }
    load()

    const channelName = `list-items-${householdId}-${listId}-${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setResult((current) => {
            if (current.scopeKey !== scopeKey) return current

            let nextItems = current.items
            if (payload.eventType === 'INSERT') {
              if (payload.new.list_id !== listId) return current
              if (current.items.some((item) => item.id === payload.new.id)) return current
              nextItems = sortListItems([...current.items, payload.new])
            }
            if (payload.eventType === 'UPDATE') {
              if (payload.new.list_id !== listId) {
                nextItems = current.items.filter((item) => item.id !== payload.new.id)
              } else {
                const exists = current.items.some((item) => item.id === payload.new.id)
                const updatedItems = exists
                  ? current.items.map((item) =>
                      item.id === payload.new.id ? payload.new : item,
                    )
                  : [...current.items, payload.new]
                nextItems = sortListItems(updatedItems)
              }
            }
            if (payload.eventType === 'DELETE') {
              nextItems = current.items.filter((item) => item.id !== payload.old.id)
            }
            return { ...current, items: nextItems }
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId, listId, scopeKey])

  const setOperationError = useCallback(
    (message) => {
      setResult((current) => ({
        scopeKey,
        items: current.scopeKey === scopeKey ? current.items : [],
        error: message,
      }))
    },
    [scopeKey],
  )

  const add = useCallback(
    async (fields) => {
      setOperationError(null)
      const { error: insertError } = await supabase.from('list_items').insert({
        ...fields,
        household_id: householdId,
        list_id: listId,
        created_by: user?.id,
        updated_by: user?.id,
      })
      if (insertError) {
        setOperationError(insertError.message)
        return false
      }
      return true
    },
    [householdId, listId, setOperationError, user],
  )

  const update = useCallback(
    async (id, fields) => {
      setOperationError(null)
      const { error: updateError } = await supabase
        .from('list_items')
        .update({ ...fields, updated_by: user?.id })
        .eq('id', id)
        .eq('list_id', listId)
      if (updateError) {
        setOperationError(updateError.message)
        return false
      }
      return true
    },
    [listId, setOperationError, user],
  )

  const remove = useCallback(
    async (id) => {
      setOperationError(null)
      const { error: deleteError } = await supabase
        .from('list_items')
        .delete()
        .eq('id', id)
        .eq('list_id', listId)
      if (deleteError) {
        setOperationError(deleteError.message)
        return false
      }
      return true
    },
    [listId, setOperationError],
  )

  const hasLoadedScope = result.scopeKey === scopeKey
  const items = hasLoadedScope ? result.items : []
  const loading = Boolean(scopeKey && !hasLoadedScope)
  const error = hasLoadedScope ? result.error : null

  return { items, loading, error, add, update, remove }
}
