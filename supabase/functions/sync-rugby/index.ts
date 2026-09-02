// Supabase Edge Function: hämtar Top 14 + Pro D2 från LNR:s officiella kalendrar.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PARIS_TIME_ZONE = 'Europe/Paris'
const USER_AGENT =
  'Mozilla/5.0 (compatible; Familjeappen/1.0; +https://github.com/Reebeecka/familjeappen)'

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
}

type FollowedClub = {
  slug: string
  id: number
  calendarUrl: string
  leagueId: number
  leagueName: string
}

const FOLLOWED_CLUBS: FollowedClub[] = [
  {
    slug: 'toulouse',
    id: 107,
    calendarUrl: 'https://top14.lnr.fr/club/toulouse/calendrier-resultats',
    leagueId: 16,
    leagueName: 'Top 14',
  },
  {
    slug: 'castres',
    id: 98,
    calendarUrl: 'https://top14.lnr.fr/club/castres/calendrier-resultats',
    leagueId: 16,
    leagueName: 'Top 14',
  },
  {
    slug: 'perpignan',
    id: 120,
    calendarUrl: 'https://top14.lnr.fr/club/perpignan/calendrier-resultats',
    leagueId: 16,
    leagueName: 'Top 14',
  },
  {
    slug: 'pau',
    id: 105,
    calendarUrl: 'https://top14.lnr.fr/club/pau/calendrier-resultats',
    leagueId: 16,
    leagueName: 'Top 14',
  },
  {
    slug: 'colomiers',
    id: 113,
    calendarUrl: 'https://prod2.lnr.fr/club/colomiers/calendrier-resultats',
    leagueId: 17,
    leagueName: 'Pro D2',
  },
  {
    slug: 'montauban',
    id: 116,
    calendarUrl: 'https://prod2.lnr.fr/club/montauban/calendrier-resultats',
    leagueId: 17,
    leagueName: 'Pro D2',
  },
  {
    slug: 'beziers',
    id: 110,
    calendarUrl: 'https://prod2.lnr.fr/club/beziers/calendrier-resultats',
    leagueId: 17,
    leagueName: 'Pro D2',
  },
  {
    slug: 'narbonne',
    id: 515,
    calendarUrl: 'https://prod2.lnr.fr/club/narbonne/calendrier-resultats',
    leagueId: 17,
    leagueName: 'Pro D2',
  },
]

const followedBySlug = new Map(FOLLOWED_CLUBS.map((club) => [club.slug, club]))

type ParsedMatch = {
  apiId: number
  leagueId: number
  leagueName: string
  season: number
  kickoffAt: string
  statusShort: 'FT' | 'NS' | 'TBD'
  homeTeamId: number
  awayTeamId: number
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY måste vara satta')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function currentSeason(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 7 ? year : year - 1
}

function teamIdFromSlug(slug: string) {
  const followed = followedBySlug.get(slug)
  if (followed) return followed.id
  let hash = 0
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return 10_000 + (hash % 90_000)
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .trim()
}

function firstCapture(html: string, pattern: RegExp) {
  const match = html.match(pattern)
  return match?.[1] ? decodeEntities(match[1]) : null
}

function parseFrenchDate(label: string, season: number) {
  const match = label
    .normalize('NFC')
    .toLowerCase()
    .match(/(\d{1,2})\s+([a-zàâäéèêëïîôùûüç]+)/)
  if (!match) return null
  const day = Number(match[1])
  const month = MONTHS[match[2]]
  if (!day || !month) return null
  const year = month >= 7 ? season : season + 1
  return { year, month, day }
}

function zonedLocalToIso(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(asUtc)).map((part) => [part.type, part.value]),
  )
  const asZone = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return new Date(asUtc - (asZone - asUtc)).toISOString()
}

function parseKickTime(block: string, hasScore: boolean) {
  if (hasScore) return null
  const result = block.match(
    /class=["']match-line__result["']([\s\S]*?)<\/div>\s*<div class=["']club-line/,
  )
  if (!result) return null
  const time = result[1].match(/(\d{1,2})h(\d{2})/)
  if (!time) return null
  return { hour: Number(time[1]), minute: Number(time[2]) }
}

function parseMatchBlock(block: string, season: number, fallbackLeague: FollowedClub) {
  const sheet = block.match(/feuille-de-match\/(\d{4})-(\d{4})\/j\d+\/(\d+)-/)
  if (!sheet) return null
  const names = [...block.matchAll(/class="club-line__name[^"]*"[^>]*>\s*([^<]+?)\s*</g)].map(
    (match) => decodeEntities(match[1]),
  )
  const slugs = [...block.matchAll(/https:\/\/(?:prod2|top14)\.lnr\.fr\/club\/([a-z0-9-]+)/g)].map(
    (match) => match[1],
  )
  if (names.length < 2 || slugs.length < 2) return null

  const dateLabel = firstCapture(block, /day-calendar-line__date">([^<]+)/)
  const parsedDate = dateLabel ? parseFrenchDate(dateLabel, season) : null
  if (!parsedDate) return null

  const score = block.match(/match-line__score[^>]*>\s*(\d+)\s*-\s*(\d+)/)
  const kick = parseKickTime(block, Boolean(score))
  const statusShort: ParsedMatch['statusShort'] = score ? 'FT' : kick ? 'NS' : 'TBD'
  const hour = kick?.hour ?? 15
  const minute = kick?.minute ?? 0
  const homeSlug = slugs[0]
  const awaySlug = slugs[1]
  const homeClub = followedBySlug.get(homeSlug)
  const leagueId = homeClub?.leagueId ?? fallbackLeague.leagueId
  const leagueName = homeClub?.leagueName ?? fallbackLeague.leagueName

  return {
    apiId: Number(sheet[3]),
    leagueId,
    leagueName,
    season: Number(sheet[1]),
    kickoffAt: zonedLocalToIso(
      PARIS_TIME_ZONE,
      parsedDate.year,
      parsedDate.month,
      parsedDate.day,
      hour,
      minute,
    ),
    statusShort,
    homeTeamId: teamIdFromSlug(homeSlug),
    awayTeamId: teamIdFromSlug(awaySlug),
    homeTeam: names[0],
    awayTeam: names[1],
    homeScore: score ? Number(score[1]) : null,
    awayScore: score ? Number(score[2]) : null,
  } satisfies ParsedMatch
}

function parseCalendarHtml(html: string, season: number, club: FollowedClub) {
  const blocks = html.split(/<div class="match-calendar-line match-calendar-line--club/)
  const matches: ParsedMatch[] = []
  for (const block of blocks.slice(1)) {
    const parsed = parseMatchBlock(block, season, club)
    if (parsed) matches.push(parsed)
  }
  return matches
}

async function fetchClubCalendar(club: FollowedClub, season: number) {
  const response = await fetch(club.calendarUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) {
    throw new Error(`${club.slug} svarade ${response.status}`)
  }
  const html = await response.text()
  return parseCalendarHtml(html, season, club)
}

function toRow(match: ParsedMatch) {
  return {
    api_id: match.apiId,
    league_id: match.leagueId,
    league_name: match.leagueName,
    season: match.season,
    kickoff_at: match.kickoffAt,
    status_short: match.statusShort,
    home_team_id: match.homeTeamId,
    away_team_id: match.awayTeamId,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    home_score: match.homeScore,
    away_score: match.awayScore,
    updated_at: new Date().toISOString(),
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  try {
    const season = currentSeason()
    const unique = new Map<number, ParsedMatch>()
    const warnings: string[] = []

    const results = await Promise.allSettled(
      FOLLOWED_CLUBS.map((club) => fetchClubCalendar(club, season)),
    )

    results.forEach((result, index) => {
      const club = FOLLOWED_CLUBS[index]
      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
        warnings.push(`${club.slug}: ${message}`)
        return
      }
      if (result.value.length === 0) {
        warnings.push(`${club.slug}: inga matcher hittades`)
      }
      for (const match of result.value) {
        unique.set(match.apiId, match)
      }
    })

    const rows = [...unique.values()].map(toRow)
    if (rows.length > 0) {
      const { error } = await admin.from('rugby_matches').upsert(rows, { onConflict: 'api_id' })
      if (error) throw error
    }

    if (rows.length === 0) {
      throw new Error(warnings[0] || 'Inga matcher kunde hämtas från LNR')
    }

    return Response.json({
      success: true,
      season,
      saved: rows.length,
      warnings,
    })
  } catch (error) {
    console.error('Kunde inte synka rugby', error)
    return Response.json(
      {
        success: false,
        error: {
          code: 'RUGBY_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Synken misslyckades',
        },
      },
      { status: 500 },
    )
  }
})
