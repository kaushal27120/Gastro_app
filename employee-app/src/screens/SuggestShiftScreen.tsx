import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '../lib/supabase'

type SuggestionType = 'off' | 'available' | 'specific'

type Suggestion = {
  id: string
  date: string
  time_start: string | null
  time_end: string | null
  note: string | null
  status: string
  suggestion_type: string | null
  created_at: string
}

const MONTH_PL_GEN = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']

const tomorrow = () => {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d
}

const todayMidnight = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

const oneYearFromNow = () => {
  const d = new Date(); d.setFullYear(d.getFullYear() + 1); d.setHours(12, 0, 0, 0); return d
}

// Safe local date string — avoids UTC off-by-one
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const TYPE_CONFIG: Record<SuggestionType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  off:       { label: 'Niedostepny',       icon: 'X',  color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
  available: { label: 'Dostepny',          icon: 'OK', color: '#065F46', bg: '#F0FDF4', border: '#BBF7D0' },
  specific:  { label: 'Konkretne godziny', icon: 'H',  color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
}

export default function SuggestShiftScreen({ navigation }: any) {
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [employeeId, setEmployeeId]   = useState<string | null>(null)
  const [locationId, setLocationId]   = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Edit mode — null = new suggestion
  const [editingId, setEditingId]     = useState<string | null>(null)

  // Form fields
  const [suggestionType, setSuggestionType] = useState<SuggestionType>('specific')
  const [date, setDate]               = useState<Date>(tomorrow)
  const [showPicker, setShowPicker]   = useState(false)
  const [timeStart, setTimeStart]     = useState('08:00')
  const [timeEnd, setTimeEnd]         = useState('16:00')
  const [note, setNote]               = useState('')

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // Try auto-link first
    await supabase.rpc('link_employee_on_login').maybeSingle()

    // 1) Employee record
    const { data: emp } = await supabase.from('employees').select('id, location_id').eq('user_id', user.id).maybeSingle()
    if (emp) {
      setEmployeeId(emp.id)
      if (emp.location_id) {
        setLocationId(emp.location_id)
      } else {
        // 2) user_access fallback
        const { data: access } = await supabase.from('user_access').select('location_id').eq('user_id', user.id).limit(1).maybeSingle()
        if (access?.location_id) {
          setLocationId(access.location_id)
        } else {
          // 3) shifts table fallback
          const { data: shift } = await supabase.from('shifts').select('location_id')
            .eq('employee_id', emp.id).not('location_id', 'is', null).order('date', { ascending: false }).limit(1).maybeSingle()
          if (shift?.location_id) setLocationId(shift.location_id)
        }
      }
    } else {
      const { data: access } = await supabase.from('user_access').select('location_id').eq('user_id', user.id).limit(1).maybeSingle()
      if (access?.location_id) setLocationId(access.location_id)
    }

    await loadSuggestions(user.id)
    setLoading(false)
  }

  const loadSuggestions = async (uid: string) => {
    const { data } = await supabase.from('shift_suggestions')
      .select('id, date, time_start, time_end, note, status, suggestion_type, created_at')
      .eq('user_id', uid)
      .order('date', { ascending: true })
      .limit(30)
    if (data) setSuggestions(data as Suggestion[])
  }

  const resetForm = () => {
    setEditingId(null)
    setSuggestionType('specific')
    setDate(tomorrow())
    setTimeStart('08:00')
    setTimeEnd('16:00')
    setNote('')
    setShowPicker(false)
  }

  const startEdit = (sug: Suggestion) => {
    setEditingId(sug.id)
    setSuggestionType((sug.suggestion_type ?? 'specific') as SuggestionType)
    const [y, m, day] = sug.date.split('-').map(Number)
    setDate(new Date(y, m - 1, day, 12, 0, 0))
    setTimeStart(sug.time_start?.slice(0, 5) ?? '08:00')
    setTimeEnd(sug.time_end?.slice(0, 5)   ?? '16:00')
    setNote(sug.note ?? '')
    setShowPicker(false)
    // scroll to top handled by user
  }

  const handleSubmit = async () => {
    if (!locationId) {
      Alert.alert('Błąd', 'Brak powiązanej lokalizacji. Skontaktuj się z managerem.')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const dateIso = toLocalDateStr(date)
    const payload = {
      suggestion_type: suggestionType,
      date: dateIso,
      time_start: suggestionType === 'specific' ? (timeStart || null) : null,
      time_end:   suggestionType === 'specific' ? (timeEnd   || null) : null,
      note: note.trim() || null,
      status: 'pending',
    }

    let error: any = null

    if (editingId) {
      // Update existing suggestion
      const { error: upErr } = await supabase.from('shift_suggestions')
        .update(payload)
        .eq('id', editingId)
      error = upErr
    } else {
      // Insert new suggestion
      const { error: insErr } = await supabase.from('shift_suggestions').insert({
        ...payload,
        employee_id: employeeId,
        user_id: user.id,
        location_id: locationId,
      })
      error = insErr
    }

    if (error) { Alert.alert('Błąd', error.message); setSaving(false); return }

    Alert.alert(editingId ? 'Zaktualizowano' : 'Wyslano',
      editingId ? 'Sugestia zostala zaktualizowana.' : 'Sugestia zostala wyslana do managera.')
    resetForm()
    await loadSuggestions(user.id)
    setSaving(false)
  }

  const handleDelete = (id: string) => {
    Alert.alert('Usuń sugestię', 'Na pewno chcesz usunąć tę sugestię?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => {
        await supabase.from('shift_suggestions').delete().eq('id', id)
        if (editingId === id) resetForm()
        if (currentUserId) await loadSuggestions(currentUserId)
      }},
    ])
  }

  const dateLabel = `${date.getDate()} ${MONTH_PL_GEN[date.getMonth()]} ${date.getFullYear()}`

  const statusLabel = (s: string) => s === 'pending' ? '⏳ Oczekuje' : s === 'approved' ? '✅ Zatwierdzona' : '❌ Odrzucona'
  const statusColor = (s: string) => s === 'pending' ? '#92400E' : s === 'approved' ? '#065F46' : '#991B1B'
  const statusBg    = (s: string) => s === 'pending' ? '#FEF3C7' : s === 'approved' ? '#D1FAE5' : '#FEE2E2'
  const typeLabel   = (t: string | null) => {
    if (t === 'off') return 'Niedostepny'
    if (t === 'available') return 'Dostepny'
    return 'Konkretne godziny'
  }
  const fmt = (t?: string | null) => (t ?? '').slice(0, 5)

  if (loading) return (
    <View style={st.loadWrap}><ActivityIndicator color="#F59E0B" size="large" /></View>
  )

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={st.back}>← Wróć</Text>
        </TouchableOpacity>
        <Text style={st.title}>{editingId ? 'Edytuj sugestię' : 'Zaproponuj zmianę'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.card}>
          <Text style={st.cardTitle}>{editingId ? '✏️ Edytuj sugestię' : 'Nowa sugestia'}</Text>
          <Text style={st.cardSub}>
            {editingId
              ? 'Zmień szczegóły sugestii. Manager zobaczy zaktualizowaną wersję.'
              : 'Powiadom managera o swojej dostępności lub zaproponuj konkretny termin.'}
          </Text>

          {/* Suggestion type selector */}
          <Text style={st.label}>Typ sugestii *</Text>
          <View style={st.typeRow}>
            {(['off', 'available', 'specific'] as SuggestionType[]).map(t => {
              const cfg = TYPE_CONFIG[t]
              const active = suggestionType === t
              return (
                <TouchableOpacity
                  key={t}
                  style={[st.typeBtn, active && { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                  onPress={() => setSuggestionType(t)}
                  activeOpacity={0.7}
                >
                  <Text style={st.typeIcon}>{cfg.icon}</Text>
                  <Text style={[st.typeTxt, active && { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Date selector button */}
          <Text style={st.label}>Data *</Text>
          <TouchableOpacity
            style={[st.datePicker, showPicker && st.datePickerOpen]}
            onPress={() => setShowPicker(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={st.datePickerTxt}>{dateLabel}</Text>
            <Text style={st.datePickerArrow}>{showPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {/* Inline calendar (iOS) / dialog (Android) */}
          {showPicker && (
            <View style={st.pickerWrap}>
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={todayMidnight()}
                maximumDate={oneYearFromNow()}
                themeVariant="light"
                accentColor="#2563EB"
                onChange={(_event: any, selected?: Date) => {
                  if (Platform.OS === 'android') {
                    setShowPicker(false)
                    if (selected) setDate(selected)
                  } else {
                    if (selected) setDate(selected)
                  }
                }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={st.doneBtn} onPress={() => setShowPicker(false)}>
                  <Text style={st.doneBtnTxt}>Gotowe</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Times — only for 'specific' type */}
          {suggestionType === 'specific' && (
            <View style={st.timeRow}>
              <View style={st.timeHalf}>
                <Text style={st.label}>Od</Text>
                <TextInput
                  value={timeStart}
                  onChangeText={setTimeStart}
                  placeholder="08:00"
                  placeholderTextColor="#9CA3AF"
                  style={st.input}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={st.timeHalf}>
                <Text style={st.label}>Do</Text>
                <TextInput
                  value={timeEnd}
                  onChangeText={setTimeEnd}
                  placeholder="16:00"
                  placeholderTextColor="#9CA3AF"
                  style={st.input}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          )}

          {/* Info banner for off/available */}
          {suggestionType === 'off' && (
            <View style={[st.infoBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Text style={[st.infoBannerTxt, { color: '#991B1B' }]}>Manager zostanie poinformowany, że nie możesz tego dnia pracować.</Text>
            </View>
          )}
          {suggestionType === 'available' && (
            <View style={[st.infoBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <Text style={[st.infoBannerTxt, { color: '#065F46' }]}>Manager zostanie poinformowany, że jesteś dostępny tego dnia.</Text>
            </View>
          )}

          <Text style={st.label}>Uwaga (opcjonalnie)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="np. mogę wcześniej/później, proszę o ten dział..."
            placeholderTextColor="#9CA3AF"
            style={[st.input, st.textArea]}
            multiline
            numberOfLines={3}
          />

          <View style={st.actionRow}>
            {editingId && (
              <TouchableOpacity style={st.cancelEditBtn} onPress={resetForm}>
                <Text style={st.cancelEditTxt}>✕ Anuluj</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[st.submitBtn, editingId && st.submitBtnEdit]} onPress={handleSubmit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={st.submitTxt}>{editingId ? 'Zapisz zmiany' : 'Wyslij sugestie'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* History */}
        {suggestions.length > 0 && (
          <View style={st.histWrap}>
            <Text style={st.histTitle}>Moje sugestie</Text>
            {suggestions.map(sug => {
              const isEditing = editingId === sug.id
              return (
                <View key={sug.id} style={[st.sugCard, isEditing && st.sugCardEditing]}>
                  <View style={st.sugTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sugDate}>{sug.date}</Text>
                      <Text style={st.sugType}>{typeLabel(sug.suggestion_type)}</Text>
                      {sug.suggestion_type === 'specific' && sug.time_start && (
                        <Text style={st.sugTime}>{fmt(sug.time_start)} – {fmt(sug.time_end)}</Text>
                      )}
                      {sug.note ? <Text style={st.sugNote}>{sug.note}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[st.statusBadge, { backgroundColor: statusBg(sug.status) }]}>
                        <Text style={[st.statusTxt, { color: statusColor(sug.status) }]}>{statusLabel(sug.status)}</Text>
                      </View>
                      {sug.status === 'pending' && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity style={st.editBtn} onPress={() => startEdit(sug)}>
                            <Text style={st.editBtnTxt}>Edyt.</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={st.deleteBtn} onPress={() => handleDelete(sug.id)}>
                            <Text style={st.deleteBtnTxt}>Usun</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#F9FAFB' },
  loadWrap:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:         { flex: 1, paddingHorizontal: 16 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:           { color: '#2563EB', fontWeight: '600', fontSize: 14, width: 60 },
  title:          { fontSize: 16, fontWeight: '700', color: '#111827' },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle:      { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardSub:        { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 20 },
  label:          { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  // Type selector
  typeRow:        { flexDirection: 'column', gap: 8, marginBottom: 20 },
  typeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  typeIcon:       { fontSize: 13, fontWeight: '700', width: 24, textAlign: 'center' },
  typeTxt:        { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  // Date
  datePicker:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8 },
  datePickerOpen: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  datePickerTxt:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  datePickerArrow:{ fontSize: 14, color: '#6B7280' },
  pickerWrap:     { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#BFDBFE', marginBottom: 16 },
  doneBtn:        { backgroundColor: '#2563EB', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingVertical: 13, alignItems: 'center' },
  doneBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoBanner:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  infoBannerTxt:  { fontSize: 12, lineHeight: 18 },
  input:          { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', marginBottom: 16 },
  textArea:       { height: 80, textAlignVertical: 'top' },
  timeRow:        { flexDirection: 'row', gap: 12 },
  timeHalf:       { flex: 1 },
  actionRow:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelEditBtn:  { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  cancelEditTxt:  { color: '#374151', fontWeight: '600', fontSize: 14 },
  submitBtn:      { flex: 1, backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnEdit:  { backgroundColor: '#059669' },
  submitTxt:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  // History
  histWrap:       { marginBottom: 16 },
  histTitle:      { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },
  sugCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  sugCardEditing: { borderColor: '#059669', borderWidth: 2, backgroundColor: '#F0FDF4' },
  sugTop:         { flexDirection: 'row', gap: 12 },
  sugDate:        { fontSize: 14, fontWeight: '700', color: '#111827' },
  sugType:        { fontSize: 11, color: '#6B7280', marginTop: 2 },
  statusBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt:      { fontSize: 11, fontWeight: '600' },
  sugTime:        { fontSize: 12, color: '#374151', marginTop: 3, fontWeight: '600' },
  sugNote:        { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 3 },
  editBtn:        { paddingHorizontal: 10, height: 30, backgroundColor: '#EFF6FF', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editBtnTxt:     { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  deleteBtn:      { paddingHorizontal: 10, height: 30, backgroundColor: '#FEF2F2', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteBtnTxt:   { fontSize: 11, fontWeight: '700', color: '#DC2626' },
})
