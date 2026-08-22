const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasRecipeType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value]
  return types.some((type) => typeof type === 'string' && type.toLowerCase() === 'recipe')
}

function findRecipe(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipe(item)
      if (recipe) return recipe
    }
    return null
  }

  if (!isRecord(value)) return null
  if (hasRecipeType(value['@type'])) return value

  if (Array.isArray(value['@graph'])) {
    const recipe = findRecipe(value['@graph'])
    if (recipe) return recipe
  }

  for (const child of Object.values(value)) {
    if (isRecord(child) || Array.isArray(child)) {
      const recipe = findRecipe(child)
      if (recipe) return recipe
    }
  }
  return null
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function imageUrl(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = imageUrl(item)
      if (url) return url
    }
  }
  if (isRecord(value)) {
    const candidate = value.url ?? value.contentUrl
    if (typeof candidate === 'string') return candidate
  }
  return null
}

function servingsFrom(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate === 'number') {
    return Number.isInteger(candidate) && candidate > 0 ? candidate : null
  }
  if (typeof candidate !== 'string') return null

  const match = candidate.match(/\d+/)
  if (!match) return null
  const servings = Number(match[0])
  return servings > 0 ? servings : null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(cleanText).filter(Boolean)
}

function instructionSteps(value: unknown): string[] {
  if (typeof value === 'string') {
    const text = cleanText(value)
    return text ? [text] : []
  }
  if (Array.isArray(value)) return value.flatMap(instructionSteps)
  if (!isRecord(value)) return []

  const text = cleanText(value.text)
  if (text) return [text]
  return instructionSteps(value.itemListElement)
}

function extractJsonLd(html: string): unknown[] {
  const values: unknown[] = []
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = scriptPattern.exec(html)) !== null) {
    const attributes = match[1]
    const isJsonLd =
      /\btype\s*=\s*(['"])application\/ld\+json\1/i.test(attributes) ||
      /\btype\s*=\s*application\/ld\+json(?:\s|$)/i.test(attributes)
    if (!isJsonLd) continue

    try {
      values.push(JSON.parse(match[2].trim()))
    } catch {
      // En sida kan innehålla flera block; ett trasigt block ska inte stoppa övriga.
    }
  }
  return values
}

function isPublicHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    const isLocal =
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe80:') ||
      hostname.endsWith('.local') ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    return !isLocal
  } catch {
    return false
  }
}

async function fetchPublicPage(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Familjeappen recipe importer',
      },
      signal: AbortSignal.timeout(10_000),
      redirect: 'manual',
    })

    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get('location')
    if (!location) return response
    const nextUrl = new URL(location, currentUrl).toString()
    if (!isPublicHttpUrl(nextUrl)) throw new Error('Otillåten omdirigering')
    await response.body?.cancel()
    currentUrl = nextUrl
  }

  throw new Error('För många omdirigeringar')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metoden stöds inte' }, 405)
  }

  try {
    const body = (await req.json()) as { url?: unknown }
    if (!isPublicHttpUrl(body.url)) {
      return jsonResponse({ error: 'Ange en giltig offentlig webbadress' }, 400)
    }

    const response = await fetchPublicPage(body.url)
    if (!response.ok) {
      return jsonResponse({ error: 'Receptsidan kunde inte hämtas' }, 422)
    }

    const html = await response.text()
    const recipe = extractJsonLd(html).map(findRecipe).find(Boolean)
    if (!recipe) {
      return jsonResponse({ error: 'Sidan innehåller inget maskinläsbart recept' }, 422)
    }

    const title = cleanText(recipe.name)
    if (!title) {
      return jsonResponse({ error: 'Receptet saknar titel' }, 422)
    }

    return jsonResponse({
      title,
      image: imageUrl(recipe.image),
      servings: servingsFrom(recipe.recipeYield),
      ingredients: stringList(recipe.recipeIngredient),
      steps: instructionSteps(recipe.recipeInstructions),
    })
  } catch {
    return jsonResponse({ error: 'Receptet kunde inte läsas automatiskt' }, 422)
  }
})
