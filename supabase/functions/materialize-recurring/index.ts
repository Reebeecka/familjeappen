// Supabase Edge Function: skapar dagens listpunkter från återkommande uppgifter.
// Körs dagligen av Supabase Scheduled Functions eller en extern cron.
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_TIME_ZONE = 'Europe/Stockholm'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY måste vara satta')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface RecurringTask {
  id: string
  cadence: 'daily' | 'weekly' | 'monthly'
  weekday: number | null
  day_of_month: number | null
  last_materialized_date: string | null
}

interface LocalDate {
  isoDate: string
  weekday: number
  dayOfMonth: number
}

function getLocalDate(now: Date): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)

  const value = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type)
    if (!part) throw new Error(`Kunde inte läsa datumdelen ${type}`)
    return part.value
  }

  const weekdayByName: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const weekdayName = value('weekday')
  const weekday = weekdayByName[weekdayName]
  if (weekday === undefined) throw new Error(`Okänd veckodag: ${weekdayName}`)

  const year = value('year')
  const month = value('month')
  const day = value('day')

  return {
    isoDate: `${year}-${month}-${day}`,
    weekday,
    dayOfMonth: Number(day),
  }
}

function isDueToday(task: RecurringTask, today: LocalDate): boolean {
  if (
    task.last_materialized_date !== null &&
    task.last_materialized_date >= today.isoDate
  ) {
    return false
  }

  if (task.cadence === 'daily') return true
  if (task.cadence === 'weekly') return task.weekday === today.weekday
  return task.day_of_month === today.dayOfMonth
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  try {
    const today = getLocalDate(new Date())
    const { data, error } = await admin
      .from('recurring_tasks')
      .select('id, cadence, weekday, day_of_month, last_materialized_date')
      .eq('active', true)

    if (error) throw error

    const dueTasks = ((data ?? []) as RecurringTask[]).filter((task) =>
      isDueToday(task, today)
    )

    let created = 0
    for (const task of dueTasks) {
      // RPC:n använder databaslås och en transaktion. Därför förblir körningen
      // idempotent även om två cron-anrop startar samtidigt.
      const { data: wasCreated, error: materializeError } = await admin.rpc(
        'materialize_recurring_task',
        {
          p_task_id: task.id,
          p_materialized_date: today.isoDate,
        },
      )

      if (materializeError) throw materializeError
      if (wasCreated) created += 1
    }

    return Response.json({
      success: true,
      date: today.isoDate,
      examined: data?.length ?? 0,
      due: dueTasks.length,
      created,
    })
  } catch (error) {
    console.error('Kunde inte materialisera återkommande uppgifter', error)
    return Response.json(
      {
        success: false,
        error: {
          code: 'MATERIALIZATION_FAILED',
          message: 'Kunde inte skapa dagens återkommande uppgifter',
        },
      },
      { status: 500 },
    )
  }
})
