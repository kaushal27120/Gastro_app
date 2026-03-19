import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Image, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'

type ClockRecord = {
  id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  clock_in_photo_url: string | null
  clock_out_photo_url: string | null
}

const formatTime = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

const calcWorked = (inAt: string | null, outAt: string | null) => {
  if (!inAt || !outAt) return null
  const mins = (new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}min`
}

export default function ClockInScreen({ navigation }: any) {
  const today = new Date().toISOString().split('T')[0]
  const [loading, setLoading]         = useState(true)
  const [actionLoading, setAction]    = useState(false)
  const [todayRecord, setTodayRecord] = useState<ClockRecord | null>(null)
  const [history, setHistory]         = useState<ClockRecord[]>([])
  const [userId, setUserId]           = useState('')
  const [locationId, setLocationId]   = useState<string | null>(null)

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Get location from user_access
    const { data: access } = await supabase.from('user_access').select('location_id').eq('user_id', user.id).limit(1).maybeSingle()
    if (access) setLocationId(access.location_id)

    await loadRecords(user.id)
    setLoading(false)
  }

  const loadRecords = async (uid: string) => {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data } = await supabase.from('shift_clock_ins')
      .select('id, work_date, clock_in_at, clock_out_at, clock_in_photo_url, clock_out_photo_url')
      .eq('user_id', uid)
      .gte('work_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('work_date', { ascending: false })
    if (data) {
      const todayRec = (data as ClockRecord[]).find(r => r.work_date === today) ?? null
      setTodayRecord(todayRec)
      setHistory((data as ClockRecord[]).filter(r => r.work_date !== today))
    }
  }

  const takePhoto = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Brak dostępu do kamery'); return null }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: false, allowsEditing: false })
    if (result.canceled || !result.assets[0]) return null
    return result.assets[0].uri
  }

  const uploadPhoto = async (uri: string, filename: string): Promise<string | null> => {
    try {
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('employee-photos').upload(filename, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) { console.error('Upload error:', error); return null }
      const { data } = supabase.storage.from('employee-photos').getPublicUrl(filename)
      return data.publicUrl
    } catch (e) { console.error(e); return null }
  }

  const handleClockIn = async () => {
    setAction(true)
    const uri = await takePhoto()
    if (!uri) { setAction(false); return }

    const now = new Date().toISOString()
    const filename = `${userId}/${today}_in_${Date.now()}.jpg`
    const photoUrl = await uploadPhoto(uri, filename)

    const { data, error } = await supabase.from('shift_clock_ins').insert({
      user_id: userId,
      location_id: locationId,
      work_date: today,
      clock_in_at: now,
      clock_in_photo_url: photoUrl,
    }).select().single()

    if (error) { Alert.alert('Błąd', error.message); setAction(false); return }
    setTodayRecord(data as ClockRecord)
    setAction(false)
    Alert.alert('Rozpoczeto zmiane', `Godzina: ${formatTime(now)}`)
  }

  const handleClockOut = async () => {
    if (!todayRecord) return
    setAction(true)
    const uri = await takePhoto()
    if (!uri) { setAction(false); return }

    const now = new Date().toISOString()
    const filename = `${userId}/${today}_out_${Date.now()}.jpg`
    const photoUrl = await uploadPhoto(uri, filename)

    const { data, error } = await supabase.from('shift_clock_ins')
      .update({ clock_out_at: now, clock_out_photo_url: photoUrl })
      .eq('id', todayRecord.id)
      .select().single()

    if (error) { Alert.alert('Błąd', error.message); setAction(false); return }
    setTodayRecord(data as ClockRecord)
    setAction(false)
    const worked = calcWorked(todayRecord.clock_in_at, now)
    Alert.alert('Zakończono zmiane', `Przepracowano: ${worked}`)
  }

  if (loading) return (
    <View style={s.loadWrap}><ActivityIndicator color="#F59E0B" size="large" /></View>
  )

  const clockedIn  = !!todayRecord?.clock_in_at
  const clockedOut = !!todayRecord?.clock_out_at
  const workedToday = calcWorked(todayRecord?.clock_in_at ?? null, todayRecord?.clock_out_at ?? null)

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Wróć</Text>
        </TouchableOpacity>
        <Text style={s.title}>Odbicia czasu pracy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Today card */}
        <View style={s.todayCard}>
          <Text style={s.todayLabel}>DZIŚ · {today}</Text>
          <View style={s.timeRow}>
            <View style={s.timeBlock}>
              <Text style={s.timeLabel}>Przyjście</Text>
              <Text style={[s.timeValue, clockedIn && s.timeGreen]}>{formatTime(todayRecord?.clock_in_at ?? null)}</Text>
            </View>
            <Text style={s.timeDash}>→</Text>
            <View style={s.timeBlock}>
              <Text style={s.timeLabel}>Wyjście</Text>
              <Text style={[s.timeValue, clockedOut && s.timeRed]}>{formatTime(todayRecord?.clock_out_at ?? null)}</Text>
            </View>
          </View>
          {workedToday && <Text style={s.workedText}>Przepracowano: {workedToday}</Text>}

          {!clockedIn && (
            <TouchableOpacity style={s.clockInBtn} onPress={handleClockIn} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockInText}>Rozpocznij zmiane</Text>}
            </TouchableOpacity>
          )}
          {clockedIn && !clockedOut && (
            <TouchableOpacity style={s.clockOutBtn} onPress={handleClockOut} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.clockOutText}>Zakoncz zmiane</Text>}
            </TouchableOpacity>
          )}
          {clockedOut && (
            <View style={s.doneBadge}><Text style={s.doneText}>Zmiana zakonczona</Text></View>
          )}
        </View>

        {/* Photo previews */}
        {(todayRecord?.clock_in_photo_url || todayRecord?.clock_out_photo_url) && (
          <View style={s.photos}>
            <Text style={s.photosTitle}>Zdjęcia potwierdzające</Text>
            <View style={s.photoRow}>
              {todayRecord.clock_in_photo_url && (
                <View style={s.photoItem}>
                  <Image source={{ uri: todayRecord.clock_in_photo_url }} style={s.photo} />
                  <Text style={s.photoLabel}>Przyjście</Text>
                </View>
              )}
              {todayRecord.clock_out_photo_url && (
                <View style={s.photoItem}>
                  <Image source={{ uri: todayRecord.clock_out_photo_url }} style={s.photo} />
                  <Text style={s.photoLabel}>Wyjście</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>Ostatnie 7 dni</Text>
            {history.map(rec => (
              <View key={rec.id} style={s.historyCard}>
                <Text style={s.historyDate}>{rec.work_date}</Text>
                <Text style={s.historyTime}>{formatTime(rec.clock_in_at)} → {formatTime(rec.clock_out_at)}</Text>
                {calcWorked(rec.clock_in_at, rec.clock_out_at) && (
                  <Text style={s.historyWorked}>{calcWorked(rec.clock_in_at, rec.clock_out_at)}</Text>
                )}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#F9FAFB' },
  loadWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  scroll:    { flex: 1, paddingHorizontal: 16 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back:      { color: '#2563EB', fontWeight: '600', fontSize: 14, width: 60 },
  title:     { fontSize: 16, fontWeight: '700', color: '#111827' },
  todayCard: { backgroundColor: '#1E3A8A', borderRadius: 20, padding: 22, marginTop: 20, marginBottom: 16 },
  todayLabel:{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16 },
  timeRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  timeBlock: { alignItems: 'center' },
  timeLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
  timeValue: { color: '#94A3B8', fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeGreen: { color: '#4ADE80' },
  timeRed:   { color: '#F87171' },
  timeDash:  { color: 'rgba(255,255,255,0.3)', fontSize: 20 },
  workedText:{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  clockInBtn: { backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  clockInText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  clockOutBtn:{ backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  clockOutText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  doneBadge: { backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  doneText:  { color: '#4ADE80', fontWeight: '700', fontSize: 15 },
  photos:    { marginBottom: 16 },
  photosTitle:{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  photoRow:  { flexDirection: 'row', gap: 12 },
  photoItem: { alignItems: 'center', flex: 1 },
  photo:     { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#E5E7EB' },
  photoLabel:{ fontSize: 11, color: '#6B7280', marginTop: 6 },
  historySection:{ marginBottom: 16 },
  historyTitle:  { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  historyCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  historyDate:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  historyTime:   { fontSize: 12, color: '#6B7280' },
  historyWorked: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
})
