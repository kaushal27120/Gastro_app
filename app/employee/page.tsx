'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/app/supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, MapPin, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function EmployeeDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const fetchMyShifts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get Name
      const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).single()
      setUserName(profile?.full_name || 'Employee')

      // Get Shifts
      const { data } = await supabase
        .from('shifts')
        .select('*, locations(name)')
        .eq('user_id', user.id)
        .gte('date', new Date().toISOString().split('T')[0]) // Only future/today
        .order('date', { ascending: true })
      
      if (data) setShifts(data)
      setLoading(false)
    }
    fetchMyShifts()
  }, [router])

  if (loading) return <div className="p-8 text-center">Loading schedule...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hello, {userName} 👋</h1>
            <p className="text-gray-500">Here is your upcoming schedule.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { supabase.auth.signOut(); router.push('/login') }}>
            <LogOut className="w-5 h-5 text-red-500" />
          </Button>
        </div>

        <div className="space-y-4">
          {shifts.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                You have no upcoming shifts.
              </CardContent>
            </Card>
          )}

          {shifts.map((shift) => (
            <Card key={shift.id} className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-lg">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    {new Date(shift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                    {shift.position}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Clock className="w-4 h-4" />
                  <span>{shift.time_start.slice(0,5)} - {shift.time_end.slice(0,5)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{shift.locations?.name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}