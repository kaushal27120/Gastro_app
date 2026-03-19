import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ijhgbdjxbakzgbnmjcbj.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ZOqc2HRX4mS1pQiqL8UWXw_nmlOpi5w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
