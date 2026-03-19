import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Podaj email i hasło.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (err) setError(err.message === 'Invalid login credentials'
      ? 'Nieprawidłowy email lub hasło.'
      : err.message)
    setLoading(false)
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#060B18" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.kav}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Logo ── */}
          <View style={s.logoWrap}>
            <View style={s.iconWrap}>
              <View style={s.iconRing1} />
              <View style={s.iconRing2} />
            </View>
            <Text style={s.logoText}>
              <Text style={s.logoOne}>One</Text>
              <Text style={s.logoLink}>Link</Text>
            </Text>
          </View>

          <Text style={s.tagline}>Panel pracownika</Text>

          {/* ── Card ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Zaloguj się</Text>
            <Text style={s.cardSub}>Sprawdź swój grafik pracy</Text>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>ADRES EMAIL</Text>
              <TextInput
                style={s.input}
                placeholder="jan@firma.pl"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>HASŁO</Text>
              <View style={s.pwWrap}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Twoje hasło"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(v => !v)}>
                  <Text style={s.eyeIcon}>{showPw ? 'Ukryj' : 'Pokaz'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Button */}
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Zaloguj się →</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>
            Nie masz dostępu? Skontaktuj się z managererem.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#060B18' },
  kav:       { flex: 1 },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoWrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 },
  iconWrap:  { width: 36, height: 36, position: 'relative' },
  iconRing1: { position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 6, borderWidth: 4, borderColor: '#3B82F6' },
  iconRing2: { position: 'absolute', top: 2, left: 2, width: 22, height: 22, borderRadius: 6, borderWidth: 4, borderColor: '#06B6D4' },
  logoText:  { fontSize: 30, fontWeight: '900' },
  logoOne:   { color: '#FFFFFF' },
  logoLink:  { color: '#3B82F6' },
  tagline:   { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 32 },

  card:      { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  cardSub:   { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 24 },

  field:     { marginBottom: 16 },
  label:     { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  input:     { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, height: 48, paddingHorizontal: 16, fontSize: 14, color: '#111827' },

  pwWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:    { padding: 8 },
  eyeIcon:   { fontSize: 12, color: '#374151', fontWeight: '600' },

  errorBox:  { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#FCA5A5', fontSize: 13 },

  btn:         { backgroundColor: '#F59E0B', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },

  footer:    { color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', marginTop: 24 },
})
