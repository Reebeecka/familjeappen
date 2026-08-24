import { useEffect, useState } from 'react'

const FRANKFURTER_URL = 'https://api.frankfurter.app'
const FETCH_TIMEOUT_MS = 8000
const memoryCache = new Map()

function todayKey() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseRate(data) {
  const rate = Number(data?.rates?.SEK)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Växelkursen kunde inte läsas.')
  }
  return { rate, rateDate: data.date }
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('Växelkursen kunde inte hämtas.')
    return await response.json()
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export function convertAmount(amount, currency, baseCurrency, eurSekRate) {
  const value = Number(amount) || 0
  if (currency === baseCurrency) return value
  const rate = Number(eurSekRate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return currency === 'EUR' ? value * rate : value / rate
}

export function formatEurSekRate(rate) {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate)
}

export function formatRateDate(dateKey) {
  if (!dateKey) return ''
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day))
}

export async function fetchEurSekRate(dateKey) {
  const today = todayKey()
  const requested = !dateKey || dateKey > today ? today : dateKey
  const cached = memoryCache.get(requested)
  if (cached) return cached

  let result
  try {
    result = parseRate(await fetchJson(`${FRANKFURTER_URL}/${requested}?from=EUR&to=SEK`))
  } catch {
    result = parseRate(await fetchJson(`${FRANKFURTER_URL}/latest?from=EUR&to=SEK`))
  }

  memoryCache.set(requested, result)
  return result
}

export function useEurSekRate(dateKey, enabled) {
  const [state, setState] = useState({
    rate: null,
    rateDate: null,
    loading: false,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ rate: null, rateDate: null, loading: false, error: null })
      return
    }

    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))

    fetchEurSekRate(dateKey)
      .then((result) => {
        if (!active) return
        setState({ ...result, loading: false, error: null })
      })
      .catch((error) => {
        if (!active) return
        setState({
          rate: null,
          rateDate: null,
          loading: false,
          error: error.message ?? 'Växelkursen kunde inte hämtas.',
        })
      })

    return () => {
      active = false
    }
  }, [dateKey, enabled])

  return state
}

export function useEurSekRates(dateKeys) {
  const cacheKey = [...new Set(dateKeys.filter(Boolean))].sort().join(',')
  const [rates, setRates] = useState({})

  useEffect(() => {
    const keys = cacheKey ? cacheKey.split(',') : []
    if (keys.length === 0) {
      setRates({})
      return
    }

    let active = true

    Promise.all(
      keys.map(async (dateKey) => {
        try {
          return [dateKey, await fetchEurSekRate(dateKey)]
        } catch {
          return null
        }
      }),
    ).then((pairs) => {
      if (!active) return
      setRates(Object.fromEntries(pairs.filter(Boolean)))
    })

    return () => {
      active = false
    }
  }, [cacheKey])

  return rates
}
