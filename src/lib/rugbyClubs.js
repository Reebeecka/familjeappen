export const RUGBY_EVENT_COLOR = '#a95743'

export const RUGBY_CLUBS = [
  {
    id: 107,
    name: 'Stade Toulousain',
    short: 'Toulouse',
    league: 'Top 14',
    city: 'Toulouse',
    stadium: 'Stade Ernest-Wallon',
    driveMinutes: 55,
    ticketsUrl: 'https://billetterie.stadetoulousain.fr/fr/',
  },
  {
    id: 113,
    name: 'Colomiers',
    short: 'Colomiers',
    league: 'Pro D2',
    city: 'Colomiers',
    stadium: 'Stade Michel-Bendichou',
    driveMinutes: 60,
    ticketsUrl: 'https://colomiers-rugby.com/billetterie/',
  },
  {
    id: 98,
    name: 'Castres Olympique',
    short: 'Castres',
    league: 'Top 14',
    city: 'Castres',
    stadium: 'Stade Pierre-Fabre',
    driveMinutes: 90,
    ticketsUrl: 'https://billetterie.castres-olympique.com/fr',
  },
  {
    id: 116,
    name: 'Montauban',
    short: 'Montauban',
    league: 'Pro D2',
    city: 'Montauban',
    stadium: 'Stade de Sapiac',
    driveMinutes: 110,
    ticketsUrl: 'https://usmsapiac.fr/billetterie',
  },
  {
    id: 110,
    name: 'Beziers',
    short: 'Béziers',
    league: 'Pro D2',
    city: 'Béziers',
    stadium: 'Stade Raoul-Barrière',
    driveMinutes: 100,
    ticketsUrl: 'https://www.asbh.net/',
  },
  {
    id: 515,
    name: 'Narbonne',
    short: 'Narbonne',
    league: 'Pro D2',
    city: 'Narbonne',
    stadium: "Parc des Sports et de l'Amitié",
    driveMinutes: 95,
    ticketsUrl: 'https://www.rcnarbonnais.fr/',
  },
  {
    id: 120,
    name: 'USA Perpignan',
    short: 'Perpignan',
    league: 'Top 14',
    city: 'Perpignan',
    stadium: 'Stade Aimé-Giral',
    driveMinutes: 130,
    ticketsUrl: 'https://billetterie.usap.fr/fr',
  },
  {
    id: 105,
    name: 'Section Paloise',
    short: 'Pau',
    league: 'Top 14',
    city: 'Pau',
    stadium: 'Stade du Hameau',
    driveMinutes: 165,
    ticketsUrl: 'https://billetterie.section-paloise.com/fr/',
  },
]

const clubsById = new Map(RUGBY_CLUBS.map((club) => [club.id, club]))

export function clubByApiId(teamId) {
  return clubsById.get(Number(teamId)) ?? null
}

export function displayTeamName(teamId, fallback) {
  return clubByApiId(teamId)?.short ?? fallback
}

export function ticketUrlForMatch(match) {
  return clubByApiId(match.home_team_id)?.ticketsUrl ?? null
}

export function venueForMatch(match) {
  const home = clubByApiId(match.home_team_id)
  if (!home) return null
  return `${home.stadium}, ${home.city}`
}

export function hasKickoffTime(match) {
  return match.status_short === 'NS'
}

export function formatMatchWhen(match) {
  const date = new Date(match.kickoff_at)
  const dateText = date.toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  if (!hasKickoffTime(match)) return dateText
  const time = date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${dateText} ${time}`
}

export function formatKickoffTime(match) {
  if (!hasKickoffTime(match)) return 'Tid ej satt'
  return new Date(match.kickoff_at).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function matchTitle(match) {
  return `${displayTeamName(match.home_team_id, match.home_team)} – ${displayTeamName(
    match.away_team_id,
    match.away_team,
  )}`
}

export function isFinished(match) {
  const status = match.status_short ?? ''
  return status === 'FT' || status === 'AET' || status === 'AP'
}

export function rugbyEventMarker(apiId) {
  return `Rugby #${apiId}`
}

export function driveLabel(match) {
  const home = clubByApiId(match.home_team_id)
  if (!home) return null
  return `ca ${home.driveMinutes} min från Pamiers`
}

export function calendarPayloadForMatch(match) {
  const venue = venueForMatch(match)
  const drive = driveLabel(match)
  const tickets = ticketUrlForMatch(match)
  const parts = [rugbyEventMarker(match.api_id)]
  if (venue) parts.push(drive ? `${venue} · ${drive}` : venue)
  if (tickets) parts.push(`Biljetter: ${tickets}`)
  return {
    title: `Rugby: ${matchTitle(match)}`,
    description: parts.join('\n'),
    start_at: match.kickoff_at,
    all_day: !hasKickoffTime(match),
    category: 'Fritid',
    color: RUGBY_EVENT_COLOR,
  }
}

export function isMatchOnCalendar(events, match) {
  const marker = rugbyEventMarker(match.api_id)
  return events.some((event) => event.description?.includes(marker))
}
