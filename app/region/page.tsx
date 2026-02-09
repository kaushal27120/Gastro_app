'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegionalDashboard() {
  const supabase = createClient()
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
       const { data: { user } } = await supabase.auth.getUser()
       if (!user) return

       // 1. Get My Locations
       const { data: access } = await supabase.from('user_access').select('location_id').eq('user_id', user.id)
       const locationIds = access?.map(a => a.location_id) || []

       // 2. Get Sales for MY locations only
       if (locationIds.length > 0) {
         const { data: sales } = await supabase
           .from('sales_daily')
           .select('*, locations(name)')
           .in('location_id', locationIds)
           .order('date', { ascending: false })
         
         if (sales) setData(sales)
       }
    }
    fetchData()
  }, [])

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">🌍 Regional Overview</h1>
      <div className="grid gap-4">
        {data.map(item => (
          <Card key={item.id}>
             <CardContent className="p-4 flex justify-between items-center">
                <div>
                   <div className="font-bold">{item.locations.name}</div>
                   <div className="text-sm text-gray-500">{item.date}</div>
                </div>
                <div className="text-xl font-bold text-green-700">
                   ${item.total_net}
                </div>
             </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}