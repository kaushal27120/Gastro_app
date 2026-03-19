import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, StatusBar, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

type Shift = {
  id: string
  date: string
  time_start: string
  time_end: string
  break_minutes?: number | null
  position?: string | null
  status?: string
  accepted_by?: string | null
  locations?: { name: string } | null
}

type Colleague = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  position: string | null
}

const MONTH_PL      = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
const MONTH_PL_GEN  = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia']
const DAY_ABBR      = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd']
const DAY_PL        = ['Nd','Pon','Wt','Śr','Czw','Pt','Sob']

const fmt = (t?: string | null) => (t ?? '').slice(0, 5)

const calcHours = (start: string, end: string) => {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

const POS_COLORS: Record<string, string> = {
  kucharz: '#F97316', kelner: '#3B82F6', kasjer: '#10B981',
  manager: '#8B5CF6', zmywak: '#EAB308', barista: '#EC4899',
  dostawa: '#06B6D4',
}
const posColor = (pos?: string | null) => pos ? (POS_COLORS[pos.toLowerCase()] ?? '#6B7280') : '#3B82F6'

const TODAY = new Date().toISOString().split('T')[0]

const buildCalGrid = (year: number, month: number): (string | null)[] => {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = (firstDay.getDay() + 6) % 7 // 0=Mon, 6=Sun
  const cells: (string | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function ScheduleScreen({ navigation }: any) {
  const [userId, setUserId]           = useState('')
  const [userName, setUserName]       = useState('')
  const [monthShifts, setMonthShifts] = useState<Shift[]>([])
  const [listShifts, setListShifts]   = useState<Shift[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [view, setView]               = useState<'calendar' | 'list' | 'team'>('calendar')
  const [calYear, setCalYear]         = useState(new Date().getFullYear())
  const [calMonth, setCalMonth]       = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [isManager, setIsManager]     = useState(false)
  const [colleagues, setColleagues]   = useState<Colleague[]>([])

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const mStart = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`
    const mEnd   = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(new Date(calYear, calMonth + 1, 0).getDate()).padStart(2, '0')}`

    // Auto-link employee account by email on first login
    await supabase.rpc('link_employee_on_login')

    // Get employee record first (needed to query by employee_id as fallback)
    const empLookup = await supabase
      .from('employees')
      .select('id, position, location_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const empId = empLookup.data?.id

    // Match shifts by user_id OR employee_id (handles cases where user_id was set after shift creation)
    const shiftFilter = empId
      ? `user_id.eq.${user.id},employee_id.eq.${empId}`
      : `user_id.eq.${user.id}`

    const [profileRes, calRes, listRes] = await Promise.all([
      supabase.from('user_profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('shifts')
        .select('id, date, time_start, time_end, break_minutes, position, status, accepted_by, locations(name)')
        .or(shiftFilter).eq('is_posted', true)
        .gte('date', mStart).lte('date', mEnd).order('date'),
      supabase.from('shifts')
        .select('id, date, time_start, time_end, break_minutes, position, status, accepted_by, locations(name)')
        .or(shiftFilter).eq('is_posted', true)
        .gte('date', TODAY).order('date').limit(50),
    ])

    const empRes = empLookup

    if (profileRes.data) setUserName(profileRes.data.full_name ?? 'Pracownik')
    if (calRes.data)  setMonthShifts(calRes.data as unknown as Shift[])
    if (listRes.data) setListShifts(listRes.data as unknown as Shift[])

    const pos   = empRes.data?.position?.toLowerCase()
    const locId = empRes.data?.location_id
    if ((pos === 'point_manager' || pos === 'manager') && locId) {
      setIsManager(true)
      const { data: cols } = await supabase.from('employees')
        .select('id, full_name, phone, email, position')
        .eq('location_id', locId).neq('user_id', user.id).order('full_name')
      if (cols) setColleagues(cols as Colleague[])
    }

    setLoading(false); setRefreshing(false)
  }, [calYear, calMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const onRefresh = () => { setRefreshing(true); fetchData(true) }

  const goMonth = (dir: 1 | -1) => {
    let m = calMonth + dir, y = calYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setCalMonth(m); setCalYear(y); setSelectedDay(null)
  }

  const calCells    = buildCalGrid(calYear, calMonth)
  const selectedShifts = selectedDay ? monthShifts.filter(s => s.date === selectedDay) : []
  const monthHours  = monthShifts.reduce((a, s) => a + calcHours(fmt(s.time_start), fmt(s.time_end)), 0)
  const firstName   = userName.split(' ')[0]

  if (loading) return (
    <View style={s.loadWrap}><ActivityIndicator color="#F59E0B" size="large" /></View>
  )

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerHi}>Cześć, {firstName} 👋</Text>
          <Text style={s.headerSub}>
            {monthHours > 0 ? `${monthHours.toFixed(1)}h w ${MONTH_PL[calMonth].toLowerCase()}` : 'Twoj grafik pracy'}
          </Text>
        </View>
        <View style={s.headerBtns}>
          <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('ClockIn')}>
            <Text style={s.actionBtnTxt}>Odbij czas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.logoutBtn} onPress={() => supabase.auth.signOut()}>
            <Text style={s.logoutTxt}>Wyloguj</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick nav */}
      <View style={s.quickNav}>
        <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('Suggest')}>
          <Text style={s.quickBtnTxt}>+ Zaproponuj zmiane</Text>
        </TouchableOpacity>
      </View>

      {/* View toggle */}
      <View style={s.tabs}>
        {(['calendar', 'list'] as const).map(v => (
          <TouchableOpacity key={v} style={[s.tab, view === v && s.tabActive]} onPress={() => setView(v)}>
            <Text style={[s.tabTxt, view === v && s.tabTxtActive]}>
              {v === 'calendar' ? 'Miesiac' : 'Lista'}
            </Text>
          </TouchableOpacity>
        ))}
        {isManager && (
          <TouchableOpacity style={[s.tab, view === 'team' && s.tabActive]} onPress={() => setView('team')}>
            <Text style={[s.tabTxt, view === 'team' && s.tabTxtActive]}>Zespol</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
      >
        {/* ── CALENDAR VIEW ── */}
        {view === 'calendar' && (
          <View style={s.calWrap}>
            {/* Month navigation */}
            <View style={s.calNav}>
              <TouchableOpacity style={s.navBtn} onPress={() => goMonth(-1)}>
                <Text style={s.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={s.calTitle}>{MONTH_PL[calMonth]} {calYear}</Text>
              <TouchableOpacity style={s.navBtn} onPress={() => goMonth(1)}>
                <Text style={s.navArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={s.dayRow}>
              {DAY_ABBR.map(d => (
                <View key={d} style={s.dayHeaderCell}>
                  <Text style={s.dayHeaderTxt}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={s.grid}>
              {calCells.map((iso, idx) => {
                if (!iso) return <View key={`e${idx}`} style={s.cell} />
                const dayShifts = monthShifts.filter(sh => sh.date === iso)
                const isToday    = iso === TODAY
                const isSel      = iso === selectedDay
                const isWeekend  = idx % 7 >= 5

                return (
                  <TouchableOpacity
                    key={iso}
                    style={[s.cell, isWeekend && s.cellWeekend, isToday && s.cellToday, isSel && s.cellSelected]}
                    onPress={() => setSelectedDay(iso === selectedDay ? null : iso)}
                    activeOpacity={0.65}
                  >
                    <Text style={[s.cellDay, isToday && s.cellDayToday, isSel && s.cellDaySelected]}>
                      {parseInt(iso.split('-')[2])}
                    </Text>
                    {dayShifts.length > 0 && (
                      <View style={s.dotRow}>
                        {dayShifts.slice(0, 3).map(sh => (
                          <View key={sh.id} style={[s.dot, { backgroundColor: isSel ? '#fff' : posColor(sh.position) }]} />
                        ))}
                      </View>
                    )}
                    {dayShifts.length > 0 && (
                      <Text style={[s.cellHours, isSel && s.cellHoursSel]}>
                        {dayShifts.reduce((a, sh) => a + calcHours(fmt(sh.time_start), fmt(sh.time_end)), 0).toFixed(0)}h
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Month summary */}
            <View style={s.calSummary}>
              <View style={s.calSumItem}>
                <Text style={s.calSumVal}>{monthShifts.length}</Text>
                <Text style={s.calSumLbl}>zmian</Text>
              </View>
              <View style={s.calSumDivider} />
              <View style={s.calSumItem}>
                <Text style={s.calSumVal}>{monthHours.toFixed(1)}h</Text>
                <Text style={s.calSumLbl}>łącznie</Text>
              </View>
              <View style={s.calSumDivider} />
              <View style={s.calSumItem}>
                <Text style={s.calSumVal}>{monthShifts.filter(s => s.accepted_by).length}</Text>
                <Text style={s.calSumLbl}>zaakceptowanych</Text>
              </View>
            </View>

            {/* Selected day detail */}
            {selectedDay && (
              <View style={s.detail}>
                <Text style={s.detailTitle}>
                  {(() => {
                    const d = new Date(selectedDay)
                    return `${DAY_PL[d.getDay()]}, ${d.getDate()} ${MONTH_PL_GEN[d.getMonth()]}`
                  })()}
                </Text>
                {selectedShifts.length === 0 ? (
                  <Text style={s.detailEmpty}>— wolny dzień —</Text>
                ) : (
                  selectedShifts.map(shift => {
                    const hours = calcHours(fmt(shift.time_start), fmt(shift.time_end))
                    const color = posColor(shift.position)
                    return (
                      <View key={shift.id} style={s.shiftCard}>
                        <View style={[s.shiftBar, { backgroundColor: color }]} />
                        <View style={s.shiftBody}>
                          <Text style={s.shiftTime}>{fmt(shift.time_start)} – {fmt(shift.time_end)}</Text>
                          <View style={s.shiftMeta}>
                            {shift.position && (
                              <View style={[s.posBadge, { backgroundColor: color + '22' }]}>
                                <Text style={[s.posTxt, { color }]}>{shift.position}</Text>
                              </View>
                            )}
                            <Text style={s.shiftHours}>{hours.toFixed(1)}h</Text>
                            {shift.break_minutes
                              ? <Text style={s.shiftBreak}>Przerwa {shift.break_minutes}min</Text>
                              : null}
                          </View>
                          {shift.locations?.name && <Text style={s.shiftLoc}>Lok: {shift.locations.name}</Text>}
                        </View>
                      </View>
                    )
                  })
                )}
              </View>
            )}
          </View>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <View style={s.listWrap}>
            {listShifts.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyIcon}>📅</Text>
                <Text style={s.emptyTitle}>Brak nadchodzących zmian</Text>
                <Text style={s.emptySub}>Manager nie opublikował jeszcze grafiku. Wróć później lub sprawdź widok miesiąca.</Text>
              </View>
            ) : listShifts.map(shift => {
              const hours   = calcHours(fmt(shift.time_start), fmt(shift.time_end))
              const color   = posColor(shift.position)
              const isToday = shift.date === TODAY
              const d       = new Date(shift.date)
              return (
                <View key={shift.id} style={[s.listCard, isToday && s.listCardToday]}>
                  <View style={[s.listBar, { backgroundColor: color }]} />
                  <View style={s.listBody}>
                    <Text style={[s.listDate, isToday && s.listDateToday]}>
                      {DAY_PL[d.getDay()]}, {d.getDate()} {MONTH_PL_GEN[d.getMonth()]}{isToday ? ' · DZIŚ' : ''}
                    </Text>
                    <Text style={s.listTime}>{fmt(shift.time_start)} – {fmt(shift.time_end)}</Text>
                    <View style={s.listMeta}>
                      {shift.position && <Text style={[s.listPos, { color }]}>{shift.position}</Text>}
                      <Text style={s.listHours}>{hours.toFixed(1)}h</Text>
                      {shift.locations?.name && <Text style={s.listLoc}>Lok: {shift.locations.name}</Text>}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* ── TEAM VIEW (managers only) ── */}
        {view === 'team' && (
          <View style={s.listWrap}>
            <Text style={s.teamTitle}>Kontakty zespołu</Text>
            {colleagues.length === 0 ? (
              <Text style={s.listEmpty}>Brak innych pracowników w tej lokalizacji</Text>
            ) : colleagues.map(col => (
              <View key={col.id} style={s.teamCard}>
                <View style={s.teamInfo}>
                  <Text style={s.teamName}>{col.full_name}</Text>
                  {col.position && <Text style={s.teamPos}>{col.position}</Text>}
                </View>
                <View style={s.teamBtns}>
                  {col.phone && (
                    <TouchableOpacity style={s.teamBtn} onPress={() => Linking.openURL(`tel:${col.phone}`)}>
                      <Text style={s.teamBtnTxt}>📞</Text>
                    </TouchableOpacity>
                  )}
                  {col.email && (
                    <TouchableOpacity style={[s.teamBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => Linking.openURL(`mailto:${col.email}`)}>
                      <Text style={s.teamBtnTxt}>✉</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const CELL_SIZE = `${(100 / 7).toFixed(4)}%` as any

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F9FAFB' },
  loadWrap:     { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  scroll:       { flex: 1 },
  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerHi:     { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerSub:    { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  headerBtns:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn:    { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  actionBtnTxt: { color: '#2563EB', fontWeight: '600', fontSize: 12 },
  logoutBtn:    { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  logoutTxt:    { color: '#EF4444', fontWeight: '600', fontSize: 12 },
  quickNav:     { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  quickBtn:     { backgroundColor: '#FEF9C3', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FDE047', alignSelf: 'flex-start' },
  quickBtnTxt:  { color: '#713F12', fontSize: 12, fontWeight: '600' },
  // Tabs
  tabs:         { flexDirection: 'row', backgroundColor: '#F3F4F6', margin: 12, borderRadius: 12, padding: 3 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive:    { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt:       { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  tabTxtActive: { color: '#111827' },
  // Calendar
  calWrap:      { paddingHorizontal: 12 },
  calNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:       { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  navArrow:     { fontSize: 24, color: '#374151', lineHeight: 28 },
  calTitle:     { fontSize: 18, fontWeight: '700', color: '#111827' },
  dayRow:       { flexDirection: 'row', marginBottom: 4 },
  dayHeaderCell:{ width: CELL_SIZE, alignItems: 'center', paddingVertical: 6 },
  dayHeaderTxt: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#F0F0F0' },
  cell:         { width: CELL_SIZE, aspectRatio: 0.9, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#F0F0F0', backgroundColor: '#fff' },
  cellWeekend:  { backgroundColor: '#FAFAFA' },
  cellToday:    { backgroundColor: '#EFF6FF' },
  cellSelected: { backgroundColor: '#1E3A8A' },
  cellDay:      { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 3 },
  cellDayToday: { color: '#2563EB' },
  cellDaySelected:{ color: '#fff' },
  dotRow:       { flexDirection: 'row', gap: 2, justifyContent: 'center', marginBottom: 1 },
  dot:          { width: 5, height: 5, borderRadius: 3 },
  cellHours:    { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  cellHoursSel: { color: 'rgba(255,255,255,0.7)' },
  calSummary:   { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  calSumItem:   { flex: 1, alignItems: 'center' },
  calSumVal:    { fontSize: 20, fontWeight: '700', color: '#111827' },
  calSumLbl:    { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  calSumDivider:{ width: 1, backgroundColor: '#F3F4F6' },
  // Day detail
  detail:       { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 10, marginBottom: 12 },
  detailTitle:  { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  detailEmpty:  { color: '#D1D5DB', fontSize: 13, textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },
  shiftCard:    { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  shiftBar:     { width: 4, borderRadius: 2 },
  shiftBody:    { flex: 1 },
  shiftTime:    { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 6 },
  shiftMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  shiftHours:   { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  shiftBreak:   { fontSize: 11, color: '#9CA3AF' },
  shiftLoc:     { fontSize: 12, color: '#6B7280', marginTop: 4 },
  posBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  posTxt:       { fontSize: 11, fontWeight: '700' },
  // List
  listWrap:     { paddingHorizontal: 12, paddingTop: 4, gap: 8 },
  listEmpty:    { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontSize: 13 },
  listCard:     { backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  listCardToday:{ borderColor: '#3B82F6', borderWidth: 1.5 },
  listBar:      { width: 5 },
  listBody:     { flex: 1, padding: 14, gap: 4 },
  listDate:     { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  listDateToday:{ color: '#1D4ED8' },
  listTime:     { fontSize: 16, fontWeight: '700', color: '#111827' },
  listMeta:     { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  listPos:      { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  listHours:    { fontSize: 12, fontWeight: '700', color: '#374151' },
  listLoc:      { fontSize: 11, color: '#9CA3AF' },
  emptyCard:    { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 16, padding: 24, marginTop: 8, alignItems: 'center' },
  emptyIcon:    { fontSize: 36, marginBottom: 8 },
  emptyTitle:   { fontSize: 15, fontWeight: '700', color: '#1E40AF', marginBottom: 6 },
  emptySub:     { fontSize: 13, color: '#3B82F6', textAlign: 'center', lineHeight: 18 },
  // Team
  teamTitle:    { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  teamCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  teamInfo:     { flex: 1 },
  teamName:     { fontSize: 14, fontWeight: '600', color: '#111827' },
  teamPos:      { fontSize: 11, color: '#6B7280', textTransform: 'capitalize', marginTop: 2 },
  teamBtns:     { flexDirection: 'row', gap: 8 },
  teamBtn:      { width: 40, height: 40, backgroundColor: '#DCFCE7', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  teamBtnTxt:   { fontSize: 18 },
})
