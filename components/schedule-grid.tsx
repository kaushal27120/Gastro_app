'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/* ─────────────────────────────────────── types ── */
type DbShift = {
  id: string
  location_id: string
  date: string
  employee_name: string
  employee_id?: string | null
  user_id?: string | null
  time_start: string
  time_end: string
  break_minutes: number
  hourly_rate: number
  hours_worked: number
  labor_cost: number
  status: string
  position?: string | null
  is_posted?: boolean
  accepted_by?: string | null
  accepted_at?: string | null
}

type ClockInRecord = {
  id: string
  user_id: string
  location_id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  clock_in_photo_url: string | null
  clock_out_photo_url: string | null
}

type ShiftSuggestion = {
  id: string
  employee_id: string | null
  user_id: string | null
  location_id: string
  date: string
  time_start: string | null
  time_end: string | null
  note: string | null
  status: string
  suggestion_type: 'off' | 'available' | 'specific' | null
  created_at: string
  employees?: { full_name: string } | null
}

const SUG_STYLE: Record<string, { cell: string; badge: string }> = {
  off:       { cell: 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100',       badge: 'bg-red-100 text-red-700' },
  available: { cell: 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100', badge: 'bg-green-100 text-green-700' },
  specific:  { cell: 'border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100', badge: 'bg-violet-100 text-violet-700' },
}
const sugStyle = (t: string | null | undefined) => SUG_STYLE[t ?? 'specific'] ?? SUG_STYLE.specific

const SUG_ICON: Record<string, string> = { off: '🚫', available: '✅', specific: '⏰' }
const sugIcon = (t: string | null | undefined) => SUG_ICON[t ?? 'specific'] ?? '💡'
const sugTypeLabel = (t: string | null | undefined) => {
  if (t === 'off') return 'Niedostępny'
  if (t === 'available') return 'Dostępny'
  return 'Konkretne godziny'
}

export type ScheduleEmployee = {
  id: string
  full_name: string
  real_hour_cost?: number | null
  base_rate?: number | null
  user_id?: string | null
  position?: string | null
  phone?: string | null
}

type ModalState = {
  open: boolean
  mode: 'add' | 'edit'
  shift: Partial<DbShift> & { emp_id?: string; publishNow?: boolean }
}

/* ──────────────────────────────────────── constants ── */
export const POSITIONS: { value: string; label: string; color: string }[] = [
  { value: 'kucharz',  label: 'Kucharz',  color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'kelner',   label: 'Kelner',   color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'kasjer',   label: 'Kasjer',   color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'manager',  label: 'Manager',  color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'zmywak',   label: 'Zmywak',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'barista',  label: 'Barista',  color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { value: 'dostawa',  label: 'Dostawa',  color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { value: 'inne',     label: 'Inne',     color: 'bg-slate-100 text-slate-700 border-slate-300' },
]
const POSITION_MAP = Object.fromEntries(POSITIONS.map(p => [p.value, p]))
const DEFAULT_COLOR = 'bg-slate-100 text-slate-700 border-slate-300'
const MONTH_NAMES = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const DAY_NAMES_SHORT = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd']

/* ─────────────────────────────────────── helpers ── */
const getWeekStartMonday = (iso: string) => {
  const d = new Date(iso); const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().split('T')[0]
}

const buildWeekDays = (weekStart: string) => {
  if (!weekStart) return []
  const start = new Date(weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    return { iso, label: DAY_NAMES_SHORT[i], dateFull: d.getDate(), month: d.getMonth(), isToday: iso === new Date().toISOString().split('T')[0], isWeekend: i >= 5 }
  })
}

const buildMonthDays = (year: number, month: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1)
    const iso = d.toISOString().split('T')[0]
    const dow = d.getDay()
    return { iso, day: i + 1, label: DAY_NAMES_SHORT[(dow === 0 ? 6 : dow - 1)], isToday: iso === today, isWeekend: dow === 0 || dow === 6 }
  })
}

// Break is PAID — do not subtract break from worked hours
const calcHours = (start: string, end: string): number => {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60)
}

const fmt = (t?: string | null) => (t ?? '').slice(0, 5)
const posColor = (pos?: string | null) => pos ? (POSITION_MAP[pos.toLowerCase()]?.color ?? DEFAULT_COLOR) : DEFAULT_COLOR

/* ─────────────────────────────────────── component ── */
export function ScheduleGrid({
  locationId,
  employees,
  supabase,
}: {
  locationId: string | undefined
  employees: ScheduleEmployee[]
  supabase: SupabaseClient
}) {
  const today = new Date().toISOString().split('T')[0]
  const todayDate = new Date()

  // ── view mode ──
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(getWeekStartMonday(today))
  const [viewYear, setViewYear] = useState(todayDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth())

  const [shifts, setShifts] = useState<DbShift[]>([])
  const [suggestions, setSuggestions] = useState<ShiftSuggestion[]>([])      // period-bounded (for grid cells)
  const [allSuggestions, setAllSuggestions] = useState<ShiftSuggestion[]>([]) // all pending (for tab)
  const [clockIns, setClockIns] = useState<ClockInRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add', shift: {} })
  const [tab, setTab] = useState<'schedule' | 'suggestions' | 'clockins'>('schedule')

  const weekDays = buildWeekDays(weekStart)
  const weekEnd = weekDays[6]?.iso ?? weekStart
  const monthDays = buildMonthDays(viewYear, viewMonth)
  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
  const monthEnd = monthDays[monthDays.length - 1]?.iso ?? monthStart

  const periodStart = viewMode === 'week' ? weekStart : monthStart
  const periodEnd   = viewMode === 'week' ? weekEnd : monthEnd
  const displayDays = viewMode === 'week' ? weekDays : monthDays

  /* ── load shifts ── */
  const loadShifts = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    const [shiftsRes, suggestRes, allSuggestRes, clockRes] = await Promise.all([
      supabase.from('shifts')
        .select('id, location_id, date, employee_name, employee_id, user_id, time_start, time_end, break_minutes, hourly_rate, hours_worked, labor_cost, status, position, is_posted, accepted_by, accepted_at')
        .eq('location_id', locationId)
        .gte('date', periodStart)
        .lte('date', periodEnd)
        .order('time_start'),
      // Period-bounded suggestions (for grid cell indicators)
      supabase.from('shift_suggestions')
        .select('id, employee_id, user_id, location_id, date, time_start, time_end, note, status, suggestion_type, created_at, employees(full_name)')
        .eq('location_id', locationId)
        .gte('date', periodStart)
        .lte('date', periodEnd)
        .order('created_at', { ascending: false }),
      // ALL pending suggestions for this location (for the Sugestie tab — no date limit)
      supabase.from('shift_suggestions')
        .select('id, employee_id, user_id, location_id, date, time_start, time_end, note, status, suggestion_type, created_at, employees(full_name)')
        .eq('location_id', locationId)
        .eq('status', 'pending')
        .order('date', { ascending: true }),
      supabase.from('shift_clock_ins')
        .select('id, user_id, location_id, work_date, clock_in_at, clock_out_at, clock_in_photo_url, clock_out_photo_url')
        .eq('location_id', locationId)
        .gte('work_date', periodStart)
        .lte('work_date', periodEnd)
        .order('work_date', { ascending: false }),
    ])
    if (!shiftsRes.error) setShifts(shiftsRes.data ?? [])
    if (!suggestRes.error) setSuggestions(suggestRes.data as unknown as ShiftSuggestion[] ?? [])
    if (!allSuggestRes.error) setAllSuggestions(allSuggestRes.data as unknown as ShiftSuggestion[] ?? [])
    if (!clockRes.error) setClockIns(clockRes.data as ClockInRecord[] ?? [])
    setLoading(false)
  }, [locationId, periodStart, periodEnd, supabase])

  useEffect(() => { loadShifts() }, [loadShifts])

  /* ── helpers ── */
  const getShifts = (emp: ScheduleEmployee, date: string) =>
    shifts.filter(s => s.employee_id ? s.employee_id === emp.id && s.date === date : s.employee_name === emp.full_name && s.date === date)

  const getPendingSuggestions = (emp: ScheduleEmployee, date: string) =>
    suggestions.filter(s => s.employee_id === emp.id && s.date === date && s.status === 'pending')

  const empRate = (emp: ScheduleEmployee) => emp.base_rate ?? emp.real_hour_cost ?? 0

  const totalPeriodHours = (emp: ScheduleEmployee) =>
    shifts.filter(s => s.employee_id ? s.employee_id === emp.id : s.employee_name === emp.full_name)
      .reduce((acc, s) => acc + calcHours(fmt(s.time_start), fmt(s.time_end)), 0)

  const totalAllHours = employees.reduce((acc, e) => acc + totalPeriodHours(e), 0)
  const draftCount = shifts.filter(s => !s.is_posted).length
  const postedCount = shifts.filter(s => s.is_posted).length

  /* ── post schedule ── */
  const postSchedule = async () => {
    if (!locationId || draftCount === 0) return
    if (!confirm(`Opublikować ${draftCount} zmian? Pracownicy zobaczą grafik w aplikacji.`)) return
    setPosting(true)
    await supabase.from('shifts')
      .update({ is_posted: true })
      .eq('location_id', locationId)
      .eq('is_posted', false)
      .gte('date', periodStart)
      .lte('date', periodEnd)
    setPosting(false)
    loadShifts()
  }

  /* ── suggest approve/reject ── */
  const handleSuggestion = async (id: string, action: 'approved' | 'rejected') => {
    await supabase.from('shift_suggestions').update({ status: action }).eq('id', id)
    loadShifts()
  }

  /* ── convert suggestion to shift ── */
  const acceptSuggestionAsShift = async (sug: ShiftSuggestion) => {
    const emp = employees.find(e => e.id === sug.employee_id)
    if (!emp || !sug.time_start || !sug.time_end) return
    const rate = empRate(emp)
    const hours = calcHours(fmt(sug.time_start), fmt(sug.time_end))
    await supabase.from('shifts').insert({
      location_id: sug.location_id,
      date: sug.date,
      employee_name: emp.full_name,
      employee_id: emp.id,
      user_id: emp.user_id ?? null,
      time_start: sug.time_start,
      time_end: sug.time_end,
      break_minutes: 0,
      hourly_rate: rate,
      status: 'scheduled',
      is_posted: false,
      proposed_by: sug.employee_id,
    })
    await supabase.from('shift_suggestions').update({ status: 'approved' }).eq('id', sug.id)
    loadShifts()
  }

  /* ── modal open ── */
  const openAdd = (emp: ScheduleEmployee, date: string) => setModal({
    open: true, mode: 'add',
    shift: { emp_id: emp.id, employee_name: emp.full_name, user_id: emp.user_id ?? null, date, time_start: '08:00', time_end: '16:00', break_minutes: 0, position: emp.position ?? '' },
  })

  const openEdit = (shift: DbShift) => setModal({
    open: true, mode: 'edit',
    shift: { ...shift, emp_id: shift.employee_id ?? undefined, time_start: fmt(shift.time_start), time_end: fmt(shift.time_end) },
  })

  /* ── save shift ── */
  const saveShift = async () => {
    if (!locationId) return
    const { time_start, time_end, date, employee_name, emp_id } = modal.shift
    if (!time_start || !time_end || !date || !employee_name) { alert('Wypełnij wszystkie wymagane pola'); return }
    const emp = employees.find(e => e.id === emp_id)
    const hourlyRate = empRate(emp ?? { id: '', full_name: '' })
    const hours = calcHours(time_start, time_end)

    if (modal.mode === 'add') {
      await supabase.from('shifts').insert({
        location_id: locationId, date, employee_name, employee_id: emp_id ?? null,
        user_id: modal.shift.user_id ?? null,
        time_start, time_end, break_minutes: Number(modal.shift.break_minutes ?? 0),
        hourly_rate: hourlyRate, status: 'scheduled', is_posted: modal.shift.publishNow ?? false,
        position: modal.shift.position || null,
      })
    } else {
      await supabase.from('shifts').update({
        time_start, time_end, break_minutes: Number(modal.shift.break_minutes ?? 0),
        hourly_rate: hourlyRate, position: modal.shift.position || null,
      }).eq('id', modal.shift.id!)
    }
    setModal(m => ({ ...m, open: false }))
    loadShifts()
  }

  const deleteShift = async (id: string) => {
    if (!confirm('Usunąć tę zmianę?')) return
    await supabase.from('shifts').delete().eq('id', id)
    setModal(m => ({ ...m, open: false }))
    loadShifts()
  }

  const navigateWeek = (dir: 1 | -1) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + dir * 7)
    setWeekStart(d.toISOString().split('T')[0])
  }

  const navigateMonth = (dir: 1 | -1) => {
    let m = viewMonth + dir; let y = viewYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setViewMonth(m); setViewYear(y)
  }

  const modalHours = modal.shift.time_start && modal.shift.time_end
    ? calcHours(modal.shift.time_start, modal.shift.time_end) : 0

  const pendingSuggestions = allSuggestions // already filtered to pending in query

  /* ── render ── */
  return (
    <div className="max-w-full space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {v === 'week' ? 'Tydzień' : 'Miesiąc'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button onClick={() => viewMode === 'week' ? navigateWeek(-1) : navigateMonth(-1)} className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-600 font-bold">
            &#8249;
          </button>
          <div className="min-w-[180px] text-center">
            {viewMode === 'week' ? (
              <span className="text-sm font-semibold text-slate-800">
                {weekDays[0] && `${weekDays[0].dateFull} – ${weekDays[6]?.dateFull} ${MONTH_NAMES[weekDays[0].month]} ${viewYear}`}
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-800">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            )}
          </div>
          <button onClick={() => viewMode === 'week' ? navigateWeek(1) : navigateMonth(1)} className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-600 font-bold">
            &#8250;
          </button>
          <button onClick={() => { setWeekStart(getWeekStartMonday(today)); setViewMonth(todayDate.getMonth()); setViewYear(todayDate.getFullYear()) }}
            className="h-8 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Dziś</button>
        </div>

        {/* Stats + Post button */}
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-slate-100 rounded text-slate-600">{totalAllHours.toFixed(1)}h</span>
            <span className="px-2 py-1 bg-slate-100 rounded text-slate-600">{shifts.length} zmian</span>
            {draftCount > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">{draftCount} roboczych</span>}
            {postedCount > 0 && <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">{postedCount} opublikowanych</span>}
          </div>
          {draftCount > 0 && (
            <Button size="sm" onClick={postSchedule} disabled={posting} className="h-8 bg-green-600 hover:bg-green-700 text-white gap-1.5">
              {posting ? 'Publikowanie...' : `Opublikuj grafik (${draftCount})`}
            </Button>
          )}
          {pendingSuggestions.length > 0 && (
            <button onClick={() => setTab('suggestions')} className="h-8 px-3 text-xs rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium">
              💡 {pendingSuggestions.length} sugestii
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['schedule', 'suggestions', 'clockins'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'schedule' ? '📅 Grafik' : t === 'suggestions' ? `💡 Sugestie ${pendingSuggestions.length > 0 ? `(${pendingSuggestions.length})` : ''}` : `📸 Odbicia czasu (${clockIns.length})`}
          </button>
        ))}
      </div>

      {/* ── SUGGESTIONS TAB ── */}
      {tab === 'suggestions' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {allSuggestions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Brak oczekujących sugestii od pracowników</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Pracownik</th>
                  <th className="px-3 py-2.5 text-left">Data</th>
                  <th className="px-3 py-2.5 text-left">Typ</th>
                  <th className="px-3 py-2.5 text-left">Godziny</th>
                  <th className="px-3 py-2.5 text-left">Uwaga</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allSuggestions.map(sug => {
                  const ss = sugStyle(sug.suggestion_type)
                  const icon = sugIcon(sug.suggestion_type)
                  const isSpecific = !sug.suggestion_type || sug.suggestion_type === 'specific'
                  return (
                  <tr key={sug.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{sug.employees?.full_name ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{sug.date}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${ss.badge}`}>
                        {icon} {sugTypeLabel(sug.suggestion_type)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {isSpecific ? `${fmt(sug.time_start)} – ${fmt(sug.time_end)}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs max-w-[200px] truncate">{sug.note ?? '—'}</td>
                    <td className="px-4 py-3">
                      {sug.status === 'pending' && (
                        <div className="flex gap-1.5">
                          {isSpecific && (
                            <button onClick={() => acceptSuggestionAsShift(sug)} className="h-7 px-2.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 font-medium">
                              + Dodaj zmianę
                            </button>
                          )}
                          <button onClick={() => handleSuggestion(sug.id, 'rejected')} className="h-7 px-2 text-xs rounded border border-slate-200 text-slate-500 hover:text-red-500">
                            Odrzuć
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CLOCK-INS TAB ── */}
      {tab === 'clockins' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {clockIns.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
                  Brak odbić czasu pracy w tym okresie
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left">Pracownik</th>
                  <th className="px-3 py-2.5 text-left">Data</th>
                  <th className="px-3 py-2.5 text-left">Przyjście</th>
                  <th className="px-3 py-2.5 text-left">Wyjście</th>
                  <th className="px-3 py-2.5 text-left">Przepracowano</th>
                  <th className="px-3 py-2.5 text-left">Zdjęcia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clockIns.map(rec => {
                  const inTime = rec.clock_in_at ? new Date(rec.clock_in_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—'
                  const outTime = rec.clock_out_at ? new Date(rec.clock_out_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—'
                  const workedMins = rec.clock_in_at && rec.clock_out_at
                    ? Math.round((new Date(rec.clock_out_at).getTime() - new Date(rec.clock_in_at).getTime()) / 60000) : null
                  const workedStr = workedMins != null ? `${Math.floor(workedMins / 60)}h ${workedMins % 60}min` : '—'
                  const empName = employees.find(e => e.user_id === rec.user_id)?.full_name ?? '—'
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{empName}</td>
                      <td className="px-3 py-3 text-slate-600">{rec.work_date}</td>
                      <td className="px-3 py-3">
                        <span className={rec.clock_in_at ? 'text-green-700 font-medium' : 'text-slate-400'}>{inTime}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={rec.clock_out_at ? 'text-red-600 font-medium' : 'text-slate-400'}>{outTime}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">{workedStr}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          {rec.clock_in_photo_url && (
                            <a href={rec.clock_in_photo_url} target="_blank" rel="noreferrer" title="Zdjęcie przyjście">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={rec.clock_in_photo_url} alt="in" className="w-10 h-10 rounded object-cover border border-green-300 hover:opacity-80" />
                            </a>
                          )}
                          {rec.clock_out_photo_url && (
                            <a href={rec.clock_out_photo_url} target="_blank" rel="noreferrer" title="Zdjęcie wyjście">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={rec.clock_out_photo_url} alt="out" className="w-10 h-10 rounded object-cover border border-red-300 hover:opacity-80" />
                            </a>
                          )}
                          {!rec.clock_in_photo_url && !rec.clock_out_photo_url && (
                            <span className="text-slate-300 text-xs">brak</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── SCHEDULE GRID ── */}
      {tab === 'schedule' && (
        <Card className="overflow-hidden border border-slate-200 shadow-sm">
          {loading && <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50 border-b">Wczytywanie...</div>}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-[160px] border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                    Pracownik
                  </th>
                  {displayDays.map(d => (
                    <th key={d.iso}
                      className={`px-1.5 py-2 text-center border-r border-slate-200 ${viewMode === 'month' ? 'min-w-[44px]' : 'min-w-[130px]'} ${d.isToday ? 'bg-blue-50' : d.isWeekend ? 'bg-slate-100/60' : ''}`}>
                      <div className={`text-[9px] font-bold uppercase ${d.isToday ? 'text-blue-600' : 'text-slate-400'}`}>{d.label}</div>
                      <div className={`font-semibold ${viewMode === 'month' ? 'text-[11px]' : 'text-sm'} mt-0.5 ${d.isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                        {'day' in d ? d.day : d.dateFull}
                      </div>
                      {d.isToday && <div className="w-1 h-1 bg-blue-500 rounded-full mx-auto mt-0.5" />}
                    </th>
                  ))}
                  <th className="px-2 py-3 text-center text-xs font-semibold uppercase text-slate-400 w-14 sticky right-0 bg-slate-50 z-10">Godz.</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr key={emp.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-blue-50/10`}>
                    {/* Employee name */}
                    <td className="px-3 py-2 border-r border-b border-slate-200 align-middle sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                          {emp.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-800 truncate max-w-[100px]">{emp.full_name}</p>
                          {emp.user_id && <p className="text-[9px] text-green-600">● aktywny</p>}
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {displayDays.map(d => {
                      const dayShifts = getShifts(emp, d.iso)
                      return (
                        <td key={d.iso}
                          className={`border-r border-b border-slate-200 align-top ${d.isToday ? 'bg-blue-50/20' : d.isWeekend ? 'bg-slate-50/40' : ''} ${viewMode === 'month' ? 'p-0.5' : 'px-1.5 py-1.5'}`}>
                          <div className={`space-y-0.5 ${viewMode === 'month' ? 'min-h-[32px]' : 'min-h-[52px]'}`}>
                            {dayShifts.map(shift => (
                              <button key={shift.id} onClick={() => openEdit(shift)}
                                className={`group/s w-full text-left rounded border cursor-pointer hover:opacity-80 active:scale-95 transition-all font-medium relative ${posColor(shift.position)} ${viewMode === 'month' ? 'px-0.5 py-0.5 text-[9px]' : 'px-1.5 py-1 text-xs'} ${!shift.is_posted ? 'opacity-70 border-dashed' : ''}`}>
                                {viewMode === 'month' ? (
                                  <div className="tabular-nums leading-tight">{fmt(shift.time_start).slice(0, 5)}</div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="tabular-nums">{fmt(shift.time_start)}–{fmt(shift.time_end)}</span>
                                      {!shift.is_posted && <span className="text-[8px] opacity-50">szkic</span>}
                                      {shift.is_posted && shift.accepted_by && <span className="text-green-600 text-[9px] font-bold">&#10003;</span>}
                                    </div>
                                    {shift.position && <div className="opacity-70 truncate text-[9px]">{POSITION_MAP[shift.position]?.label ?? shift.position}</div>}
                                    <div className="opacity-50 text-[9px]">{calcHours(fmt(shift.time_start), fmt(shift.time_end)).toFixed(1)}h</div>
                                  </>
                                )}
                              </button>
                            ))}
                            {getPendingSuggestions(emp, d.iso).map(sug => {
                              const ss = sugStyle(sug.suggestion_type)
                              const icon = sugIcon(sug.suggestion_type)
                              const isSpecific = !sug.suggestion_type || sug.suggestion_type === 'specific'
                              return (
                                <button key={`sg-${sug.id}`} onClick={() => setTab('suggestions')}
                                  title={`${sugTypeLabel(sug.suggestion_type)}: ${isSpecific ? `${fmt(sug.time_start)}–${fmt(sug.time_end)}` : ''}${sug.note ? '\n' + sug.note : ''}`}
                                  className={`w-full text-left rounded border-dashed cursor-pointer transition-all font-medium ${ss.cell} ${viewMode === 'month' ? 'px-0.5 py-0.5 text-[9px]' : 'px-1.5 py-1 text-xs'}`}>
                                  {viewMode === 'month' ? icon : (
                                    <>
                                      <div className="flex items-center gap-0.5">
                                        <span>{icon}</span>
                                        {isSpecific && <span className="tabular-nums">{fmt(sug.time_start)}–{fmt(sug.time_end)}</span>}
                                      </div>
                                      <div className="opacity-70 text-[9px]">{sugTypeLabel(sug.suggestion_type)}</div>
                                    </>
                                  )}
                                </button>
                              )
                            })}
                            <button onClick={() => openAdd(emp, d.iso)}
                              className={`w-full rounded border-dashed border-slate-200 text-slate-300 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center ${viewMode === 'month' ? 'h-4 border text-[10px]' : 'h-6 border text-sm'}`}>
                              +
                            </button>
                          </div>
                        </td>
                      )
                    })}

                    {/* Total hours */}
                    <td className="px-2 py-2 border-b border-slate-200 text-center sticky right-0 bg-inherit z-10">
                      <span className="text-xs font-bold text-slate-700">{totalPeriodHours(emp).toFixed(1)}h</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1">
              {POSITIONS.map(p => (
                <span key={p.value} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${p.color}`}>{p.label}</span>
              ))}
            </div>
            <div className="ml-auto flex gap-3 text-[10px] text-slate-400">
              <span>-- Szkic</span>
              <span>&#9644; Opublikowany</span>
              <span className="text-green-600">&#10003; Zaakceptowany</span>
              <span className="text-red-500">🚫 Niedostępny</span>
              <span className="text-green-600">✅ Dostępny</span>
              <span className="text-violet-500">⏰ Konkretne godziny</span>
            </div>
          </div>
        </Card>
      )}

      {/* ── EDIT/ADD MODAL ── */}
      <Dialog open={modal.open} onOpenChange={o => setModal(m => ({ ...m, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modal.mode === 'add' ? 'Nowa zmiana' : 'Edytuj zmianę'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1.5 block">Pracownik</Label>
              <p className="text-sm font-medium text-slate-800">{modal.shift.employee_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">Data: {modal.shift.date}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Godzina rozpoczęcia</Label>
                <Input type="time" value={modal.shift.time_start ?? ''} onChange={e => setModal(m => ({ ...m, shift: { ...m.shift, time_start: e.target.value } }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Godzina zakończenia</Label>
                <Input type="time" value={modal.shift.time_end ?? ''} onChange={e => setModal(m => ({ ...m, shift: { ...m.shift, time_end: e.target.value } }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Przerwa (min) — wliczona w czas</Label>
                <Input type="number" min="0" max="120" step="5" value={modal.shift.break_minutes ?? 0} onChange={e => setModal(m => ({ ...m, shift: { ...m.shift, break_minutes: Number(e.target.value) } }))} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Stanowisko</Label>
                <Select value={modal.shift.position || 'none'} onValueChange={v => setModal(m => ({ ...m, shift: { ...m.shift, position: v === 'none' ? null : v } }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Wybierz…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak —</SelectItem>
                    {POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {modalHours > 0 && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-800 font-medium">
                Czas pracy: <strong>{modalHours.toFixed(2)} h</strong>
                <span className="text-blue-500 text-xs ml-2">(przerwa wliczona)</span>
              </div>
            )}
            {modal.mode === 'add' && (
              <label className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={modal.shift.publishNow ?? false}
                  onChange={e => setModal(m => ({ ...m, shift: { ...m.shift, publishNow: e.target.checked } }))}
                  className="w-4 h-4 rounded accent-green-600" />
                <span className="text-xs text-amber-800">Opublikuj od razu — pracownicy zobaczą zmianę natychmiast w aplikacji</span>
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            {modal.mode === 'edit' && (
              <Button variant="destructive" size="sm" onClick={() => deleteShift(modal.shift.id!)}>
                Usuń
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setModal(m => ({ ...m, open: false }))}>Anuluj</Button>
            <Button size="sm" onClick={saveShift}>{modal.mode === 'add' ? 'Dodaj zmianę' : 'Zapisz zmiany'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
