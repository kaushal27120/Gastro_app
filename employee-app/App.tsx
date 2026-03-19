import 'react-native-url-polyfill/auto'
import React, { useState, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, ActivityIndicator } from 'react-native'
import { Session } from '@supabase/supabase-js'
import { supabase } from './src/lib/supabase'
import LoginScreen from './src/screens/LoginScreen'
import ScheduleScreen from './src/screens/ScheduleScreen'
import ClockInScreen from './src/screens/ClockInScreen'
import SuggestShiftScreen from './src/screens/SuggestShiftScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#060B18', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#F59E0B" size="large" />
    </View>
  )

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Schedule"  component={ScheduleScreen} />
            <Stack.Screen name="ClockIn"   component={ClockInScreen} />
            <Stack.Screen name="Suggest"   component={SuggestShiftScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
