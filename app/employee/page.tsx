'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/app/supabase-client'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, LogOut, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ─────────────── helpers ─────────────── */
const DAY_NAMES   = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']
const MONTH_NAMES = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']

const getWeekStart = (iso: string): string => {
  const d = new Date(iso); const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1)); return d.toISOString().split('T')[0]
}

const buildWeekDays = (weekStart: string) => {
  const start = new Date(weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    return {
      iso, label: DAY_NAMES[i], dateFull: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
      isToday: iso === new Date().toISOString().split('T')[0],
      isWeekend: i >= 5,
    }
  })
}

const fmt = (t?: string) => (t ?? '').slice(0, 5)

const calcHours = (start: string, end: string, breakMins = 0) => {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm - breakMins) / 60)
}

const POSITION_COLORS: Record<string, string> = {
  kucharz: 'bg-orange-100 text-orange-800 border-orange-300',
  kelner:  'bg-blue-100 text-blue-800 border-blue-300',
  kasjer:  'bg-emerald-100 text-emerald-800 border-emerald-300',
  manager: 'bg-purple-100 text-purple-800 border-purple-300',
  zmywak:  'bg-yellow-100 text-yellow-800 border-yellow-300',
  barista: 'bg-pink-100 text-pink-800 border-pink-300',
  dostawa: 'bg-cyan-100 text-cyan-800 border-cyan-300',
}
const posColor = (pos?: string | null) =>
  pos ? (POSITION_COLORS[pos.toLowerCase()] ?? 'bg-slate-100 text-slate-700 border-slate-300')
      : 'bg-blue-100 text-blue-800 border-blue-300'

type Shift = {
  id: string; date: string
  time_start: string; time_end: string
  break_minutes?: number
  position?: string | null
  locations?: { name: string } | null
}

/* ─────────────── component ─────────────── */
export default function EmployeeDashboard() {
  const supabase  = createClient()
  const router    = useRouter()
  const today     = new Date().toISOString().split('T')[0]

  const [shifts,    setShifts]    = useState<Shift[]>([])
  const [loading,   setLoading]   = useState(true)
  const [userName,  setUserName]  = useState('')
  const [view,      setView]      = useState<'week' | 'list'>('week')
  const [weekStart, setWeekStart] = useState(getWeekStart(today))

  const weekDays = buildWeekDays(weekStart)
  const weekEnd  = weekDays[6]?.iso ?? weekStart

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('user_profiles').select('full_name').eq('id', user.id).single()
      setUserName(profile?.full_name ?? 'Pracownik')

      // Fetch upcoming shifts linked to this auth user
      const { data } = await supabase
        .from('shifts')
        .select('id, date, time_start, time_end, break_minutes, position, locations(name)')
        .eq('user_id', user.id)
        .gte('date', today)
        .order('date', { ascending: true })
      setShifts(data ?? [])
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigateWeek = (dir: 1 | -1) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + dir * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const weekShifts  = shifts.filter(s => s.date >= weekStart && s.date <= weekEnd)
  const weekHours   = weekShifts.reduce((a, s) => a + calcHours(fmt(s.time_start), fmt(s.time_end), s.break_minutes ?? 0), 0)
  const nextShift   = shifts[0]

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Wczytywanie harmonogramu...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Cześć, {userName.split(' ')[0]}</h1>
            <p className="text-xs text-gray-400">Twój harmonogram pracy</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'week' ? 'default' : 'outline'} size="sm"
              onClick={() => setView('week')} className="h-8 text-xs"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" /> Tydzień
            </Button>
            <Button
              variant={view === 'list' ? 'default' : 'outline'} size="sm"
              onClick={() => setView('list')} className="h-8 text-xs"
            >
              <List className="w-3.5 h-3.5 mr-1" /> Lista
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => { supabase.auth.signOut(); router.push('/auth/login') }}>
              <LogOut className="w-4 h-4 text-red-400" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* No shifts / not linked message */}
        {shifts.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800">
            <p className="font-semibold mb-1">Brak zaplanowanych zmian</p>
            <p className="text-xs text-blue-600">
              Jeśli manager już ułożył grafik, poproś go o powiązanie Twojego konta
              (podaj mu swój adres e-mail). Zmiany pojawią się tutaj automatycznie.
            </p>
          </div>
        )}

        {/* Next shift hero card */}
        {nextShift && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 text-white shadow-lg">
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-2">Najbliższa zmiana</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {fmt(nextShift.time_start)} – {fmt(nextShift.time_end)}
                </p>
                <p className="text-blue-100 text-sm mt-1 capitalize">
                  {new Date(nextShift.date).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {nextShift.locations?.name && (
                  <div className="flex items-center gap-1 mt-2 text-blue-200 text-xs">
                    <MapPin className="w-3.5 h-3.5" />{nextShift.locations.name}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                {nextShift.position && (
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full capitalize block">
                    {nextShift.position}
                  </span>
                )}
                <p className="text-blue-100 text-xs mt-2">
                  {calcHours(fmt(nextShift.time_start), fmt(nextShift.time_end), nextShift.break_minutes ?? 0).toFixed(1)} godz.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── WEEK VIEW ── */}
        {view === 'week' && (
          <div>
            {/* Week nav */}
            <div className="flex items-center justify-between mb-3">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  {weekDays[0] && `${weekDays[0].dateFull} ${weekDays[0].month}`}
                  {' – '}
                  {weekDays[6] && `${weekDays[6].dateFull} ${weekDays[6].month} ${new Date(weekStart).getFullYear()}`}
                </p>
                {weekHours > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {weekShifts.length} {weekShifts.length === 1 ? 'zmiana' : 'zmiany'} · {weekHours.toFixed(1)} godz.
                  </p>
                )}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* 7-tile week grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map(d => {
                const dayShifts = weekShifts.filter(s => s.date === d.iso)
                return (
                  <div
                    key={d.iso}
                    className={`rounded-xl border p-2 min-h-[100px] flex flex-col gap-1
                      ${d.isToday ? 'border-blue-400 bg-blue-50 shadow-sm' : d.isWeekend ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="text-center mb-1">
                      <p className={`text-[10px] font-bold uppercase ${d.isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                        {d.label}
                      </p>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold
                        ${d.isToday ? 'bg-blue-500 text-white' : 'text-slate-700'}`}>
                        {d.dateFull}
                      </div>
                    </div>
                    {dayShifts.map(shift => (
                      <div key={shift.id} className={`rounded-lg border px-1.5 py-1 text-center ${posColor(shift.position)}`}>
                        <p className="text-[10px] font-bold tabular-nums leading-tight">{fmt(shift.time_start)}</p>
                        <p className="text-[10px] tabular-nums leading-tight opacity-75">{fmt(shift.time_end)}</p>
                        {shift.position && (
                          <p className="text-[9px] capitalize opacity-60 mt-0.5 leading-none truncate">{shift.position}</p>
                        )}
                      </div>
                    ))}
                    {dayShifts.length === 0 && (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] text-slate-300">–</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {weekShifts.length === 0 && (
              <p className="text-center text-sm text-slate-400 mt-4">Brak zmian w tym tygodniu.</p>
            )}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && shifts.length > 0 && (
          <div className="space-y-3">
            {shifts.map(shift => {
              const hrs = calcHours(fmt(shift.time_start), fmt(shift.time_end), shift.break_minutes ?? 0)
              const borderColor = (shift.position
                ? (POSITION_COLORS[shift.position.toLowerCase()]?.split(' ')[0] ?? 'bg-blue-100')
                : 'bg-blue-100'
              ).replace('bg-', 'border-l-')
              return (
                <div key={shift.id} className={`bg-white rounded-2xl border-l-4 shadow-sm p-4 ${borderColor}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-gray-900 capitalize">
                          {new Date(shift.date).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="font-mono">{fmt(shift.time_start)} – {fmt(shift.time_end)}</span>
                        <span className="text-xs text-slate-400">({hrs.toFixed(1)} godz.)</span>
                      </div>
                      {shift.locations?.name && (
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5" />{shift.locations.name}
                        </div>
                      )}
                    </div>
                    {shift.position && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize shrink-0 ${posColor(shift.position)}`}>
                        {shift.position}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
