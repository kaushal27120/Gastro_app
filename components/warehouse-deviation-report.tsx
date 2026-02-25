'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/supabase-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, TrendingUp, Download, ChevronDown, Loader2 } from 'lucide-react'

interface DeviationRecord {
  id: string
  ingredient: string
  category: string
  theoreticalUse: number
  actualUse: number
  deviation: number
  deviationPct: number
  valueZl: number
  status: 'ok' | 'warning' | 'critical'
  type: 'positive' | 'negative'
}

interface WarehouseDeviationProps {
  deviations?: DeviationRecord[]
  onExplain?: (id: string, notes: string) => void
}

export function WarehouseDeviationReport({
  deviations: initialDeviations,
  onExplain
}: WarehouseDeviationProps) {
  const supabase = createClient()
  const [deviations, setDeviations] = useState<DeviationRecord[]>(initialDeviations || [])
  const [loading, setLoading] = useState(true)
  const [selectedDeviation, setSelectedDeviation] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState<{ [key: string]: boolean }>({})
  const [explanationNotes, setExplanationNotes] = useState<{ [key: string]: string }>({})
  const [periodStart, setPeriodStart] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [periodEnd, setPeriodEnd] = useState<string>(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchDeviations()
  }, [periodStart, periodEnd])

  const fetchDeviations = async () => {
    setLoading(true)
    try {
      // Fetch warehouse_deviations with ingredient details
      const { data: deviationData, error: devError } = await supabase
        .from('warehouse_deviations')
        .select('*')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('deviation_pct', { ascending: false })
      
      if (devError) {
        console.warn('⚠️ No deviations table or data:', devError)
        setDeviations([])
        setLoading(false)
        return
      }

      // Fetch ingredients for names and categories
      const { data: ingredientData } = await supabase.from('ingredients').select('id, name, category')

      // Transform data to match DeviationRecord format
      const transformed = (deviationData || []).map((dev: any) => {
        const ingredient = ingredientData?.find((i: any) => i.id === dev.ingredient_id)
        const deviation = dev.actual_usage - dev.theoretical_usage
        const deviationPct = dev.theoretical_usage > 0 ? Math.abs(deviation / dev.theoretical_usage) * 100 : 0
        
        // Determine status based on deviation percentage
        let status: 'ok' | 'warning' | 'critical' = 'ok'
        if (deviationPct > 20) status = 'critical'
        else if (deviationPct > 10) status = 'warning'

        return {
          id: dev.id,
          ingredient: ingredient?.name || 'Unknown',
          category: ingredient?.category || 'Uncategorized',
          theoreticalUse: dev.theoretical_usage || 0,
          actualUse: dev.actual_usage || 0,
          deviation: deviation,
          deviationPct: deviationPct,
          valueZl: dev.deviation_value || 0,
          status: status,
          type: deviation > 0 ? 'positive' : 'negative',
        }
      })

      setDeviations(transformed)
    } catch (err) {
      console.error('❌ Error fetching deviations:', err)
      setDeviations([])
    } finally {
      setLoading(false)
    }
  }

  const totalDeviation = deviations.reduce((sum, d) => sum + d.valueZl, 0)
  const losses = deviations.filter(d => d.type === 'positive').reduce((sum, d) => sum + d.valueZl, 0)
  const surplus = deviations.filter(d => d.type === 'negative').reduce((sum, d) => sum + Math.abs(d.valueZl), 0)
  const critical = deviations.filter(d => d.status === 'critical').length

  const statusBadge = (status: 'ok' | 'warning' | 'critical') => {
    const badges = {
      ok: { emoji: '🟢', text: 'OK', bg: 'bg-green-50', text_color: 'text-green-700' },
      warning: { emoji: '🟡', text: 'Warning', bg: 'bg-yellow-50', text_color: 'text-yellow-700' },
      critical: { emoji: '🔴', text: 'Critical', bg: 'bg-red-50', text_color: 'text-red-700' },
    }
    const badge = badges[status]
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text_color}`}>
        {badge.emoji} {badge.text}
      </span>
    )
  }

  const possibleCauses = (ingredient: string): string[] => {
    const causes: { [key: string]: string[] } = {
      'Salmon': ['Portioning error', 'Recipe outdated', 'Storage loss', 'Inventory error'],
      'Beef': ['Porcioning inconsistency', 'Waste not recorded', 'Inventory count error'],
      'Butter': ['Spillage', 'Cooking tests', 'Inventory rounding'],
      'Potatoes': ['Peeling waste', 'Portion size variance'],
      'Cream': ['Spillage', 'Test batches'],
    }
    return causes[ingredient] || ['Portioning error', 'Inventory error', 'Waste not recorded']
  }

  return (
    <div className="w-full space-y-4">
      {/* Period Selector */}
      <div className="bg-white p-4 rounded-lg border space-y-3">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Początek okresu</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Koniec okresu</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Odśwież</Label>
            <Button onClick={fetchDeviations} disabled={loading} className="w-full" variant="outline">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : '🔄'}
              Przeładuj
            </Button>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Status</Label>
            <div className="h-10 flex items-center text-sm">
              {loading ? <span className="text-blue-600">Wczytywanie...</span> : <span className="text-green-600">✓ {deviations.length} rekordów</span>}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Lista odchyleń</TabsTrigger>
          <TabsTrigger value="details">Analiza szczegółowa</TabsTrigger>
          <TabsTrigger value="trends">Trendy</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Suma wartoci odchyleń</div>
              <div className="text-2xl font-bold text-orange-600">{totalDeviation.toFixed(0)} zł</div>
              <div className="text-xs text-gray-500">za okres</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">🔴 Straty (niewytłumaczone)</div>
              <div className="text-2xl font-bold text-red-600">{losses.toFixed(0)} zł</div>
              <div className="text-xs text-gray-500">więcej niż oczekiwano</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">🟢 Nadwyżka</div>
              <div className="text-2xl font-bold text-green-600">{surplus.toFixed(0)} zł</div>
              <div className="text-xs text-gray-500">mniej niż zaplanowano</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">🔴 Krytyczne pozycje</div>
              <div className="text-2xl font-bold text-red-600">{critical}</div>
              <div className="text-xs text-gray-500">&gt;10% deviation</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Deviations Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Odchylenia składników</CardTitle>
              <CardDescription>Zużycie teoretyczne vs rzeczywiste</CardDescription>
            </div>
            <Button variant="outline" className="gap-2">
              <Download size={16} />
              Eksport
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">Składnik</th>
                    <th className="text-left p-3 font-semibold">Kategoria</th>
                    <th className="text-right p-3 font-semibold">Teoretyczne</th>
                    <th className="text-right p-3 font-semibold">Rzeczywiste</th>
                    <th className="text-right p-3 font-semibold">Odchylenie</th>
                    <th className="text-right p-3 font-semibold">%</th>
                    <th className="text-right p-3 font-semibold">Wartość (zł)</th>
                    <th className="text-center p-3 font-semibold">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {deviations.map((dev) => (
                    <tr key={dev.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{dev.ingredient}</td>
                      <td className="p-3 text-gray-600">{dev.category}</td>
                      <td className="p-3 text-right">12.4 kg</td>
                      <td className="p-3 text-right font-semibold">
                        {dev.theoreticalUse + dev.deviation} kg
                      </td>
                      <td className="p-3 text-right font-semibold">
                        <span className={dev.type === 'positive' ? 'text-red-600' : 'text-green-600'}>
                          {dev.type === 'positive' ? '+' : '−'}{Math.abs(dev.deviation).toFixed(1)} kg
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={dev.deviationPct > 10 ? 'font-bold text-red-600' : 'text-gray-600'}>
                          {dev.type === 'positive' ? '+' : '−'}{dev.deviationPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold">{dev.valueZl.toFixed(0)} zł</td>
                      <td className="p-3 text-center">{statusBadge(dev.status)}</td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDeviation(selectedDeviation === dev.id ? null : dev.id)
                            setShowDetails(prev => ({ ...prev, [dev.id]: !prev[dev.id] }))
                          }}
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${showDetails[dev.id] ? 'rotate-180' : ''}`}
                          />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* DETAILS TAB */}
      <TabsContent value="details" className="space-y-4">
        {deviations
          .filter(d => d.status === 'critical')
          .map((dev) => (
            <Card key={dev.id} className="border-2 border-red-200">
              <CardHeader className="bg-red-50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      🔴 {dev.ingredient}
                      <span className="text-lg font-normal text-red-600">
                        {dev.type === 'positive' ? '+' : '−'}{dev.deviationPct}%
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Period 01–19.02.2026 | Deviation: {dev.type === 'positive' ? '+' : '−'}
                      {Math.abs(dev.deviation).toFixed(1)} kg ({dev.valueZl.toFixed(0)} zł)
                    </CardDescription>
                  </div>
                  {statusBadge(dev.status)}
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* Usage Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-base">Theoretical Consumption</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Grilled Salmon (48 pcs)</span>
                          <span className="font-semibold">9.60 kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Salmon Salad (14 pcs)</span>
                          <span className="font-semibold">1.40 kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fish Soup (7 pcs)</span>
                          <span className="font-semibold">1.40 kg</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>TOTAL</span>
                          <span>12.40 kg</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50">
                    <CardHeader>
                      <CardTitle className="text-base">Actual Consumption</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Opening stock (01.02)</span>
                          <span className="font-semibold">8.20 kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>+ Delivery FV/2026/014</span>
                          <span className="font-semibold">+10.00 kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>+ Delivery FV/2026/021</span>
                          <span className="font-semibold">+8.00 kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>− Closing stock (19.02)</span>
                          <span className="font-semibold">−1.10 kg</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>ACTUAL USAGE</span>
                          <span>15.10 kg</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Possible Causes */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex gap-3">
                    <AlertCircle className="text-yellow-700 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-semibold text-yellow-900 mb-2">
                        Large deviation (+21.8%). Possible causes:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-800">
                        {possibleCauses(dev.ingredient).map((cause, idx) => (
                          <li key={idx}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Explanation Notes */}
                <div className="space-y-2">
                  <Label className="font-semibold">Explanation Notes</Label>
                  <Textarea
                    placeholder="After speaking with kitchen staff... (this creates an audit trail)"
                    value={explanationNotes[dev.id] || ''}
                    onChange={(e) => setExplanationNotes({ ...explanationNotes, [dev.id]: e.target.value })}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        onExplain?.(dev.id, explanationNotes[dev.id] || '')
                        setExplanationNotes({ ...explanationNotes, [dev.id]: '' })
                      }}
                    >
                      ✓ Mark as Explained
                    </Button>
                    <Button variant="outline">View History</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </TabsContent>

      {/* TRENDS TAB */}
      <TabsContent value="trends" className="space-y-4">
        {deviations.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-500">Brak danych odchyleń do wyświetlenia</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top Deviating Ingredients */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp size={20} />
                  Top odchylenia
                </CardTitle>
                <CardDescription>Składniki z największymi odchyleniami w wybranym okresie</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deviations
                    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))
                    .slice(0, 5)
                    .map((dev, idx) => (
                      <div key={dev.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-gray-600">#{idx + 1}</span>
                            <div>
                              <span className="font-semibold">{dev.ingredient}</span>
                              <p className="text-xs text-gray-500">{dev.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-bold ${dev.type === 'positive' ? 'text-red-600' : 'text-green-600'}`}>
                              {dev.type === 'positive' ? '+' : '−'}{dev.deviationPct.toFixed(1)}%
                            </span>
                            <p className="text-xs text-gray-500">{dev.type === 'positive' ? '+' : '−'}{Math.abs(dev.deviation).toFixed(1)} j.m.</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              dev.type === 'positive' 
                                ? 'bg-red-500' 
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(dev.deviationPct, 100)}%` }}
                          />
                        </div>
                        <p className={`text-xs ${dev.status === 'critical' ? 'text-red-600' : dev.status === 'warning' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {dev.status === 'critical' && '🔴 Krytyczne'}
                          {dev.status === 'warning' && '🟠 Ostrzeżenie'}
                          {dev.status === 'ok' && '🟢 OK'} 
                          {dev.type === 'positive' && ' — możliwa strata lub błąd receptury'}
                          {dev.type === 'negative' && ' — mniej zużycia niż oczekiwano'}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Podsumowanie statusów</CardTitle>
                <CardDescription>Rozkład odchyleń wg kategorii ryzyka</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-600">
                      {deviations.filter(d => d.status === 'critical').length}
                    </div>
                    <div className="text-sm text-red-700 font-semibold">Krytyczne</div>
                    <div className="text-xs text-red-600 mt-1">
                      {deviations.filter(d => d.status === 'critical').length > 0 
                        ? `${((deviations.filter(d => d.status === 'critical').length / deviations.length) * 100).toFixed(0)}% składników`
                        : 'Brak'}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-600">
                      {deviations.filter(d => d.status === 'warning').length}
                    </div>
                    <div className="text-sm text-yellow-700 font-semibold">Ostrzeżenia</div>
                    <div className="text-xs text-yellow-600 mt-1">
                      {deviations.filter(d => d.status === 'warning').length > 0
                        ? `${((deviations.filter(d => d.status === 'warning').length / deviations.length) * 100).toFixed(0)}% składników`
                        : 'Brak'}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-600">
                      {deviations.filter(d => d.status === 'ok').length}
                    </div>
                    <div className="text-sm text-green-700 font-semibold">W normie</div>
                    <div className="text-xs text-green-600 mt-1">
                      {deviations.filter(d => d.status === 'ok').length > 0
                        ? `${((deviations.filter(d => d.status === 'ok').length / deviations.length) * 100).toFixed(0)}% składników`
                        : 'Brak'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Type Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Typ odchyleń</CardTitle>
                <CardDescription>Rozkład strat vs nadwyżek</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-lg font-bold text-red-600">
                      {deviations.filter(d => d.type === 'positive').length}
                    </div>
                    <div className="text-sm text-red-700 font-semibold">Straty/Nadmierne zużycie</div>
                    <div className="text-xs text-red-600 mt-2">
                      Łącznie: {deviations
                        .filter(d => d.type === 'positive')
                        .reduce((sum, d) => sum + d.valueZl, 0)
                        .toFixed(0)} zł
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-lg font-bold text-green-600">
                      {deviations.filter(d => d.type === 'negative').length}
                    </div>
                    <div className="text-sm text-green-700 font-semibold">Nadwyżki/Mniej zużycia</div>
                    <div className="text-xs text-green-600 mt-2">
                      Łącznie: {Math.abs(deviations
                        .filter(d => d.type === 'negative')
                        .reduce((sum, d) => sum + d.valueZl, 0))
                        .toFixed(0)} zł
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>
      </Tabs>
    </div>
  )
}
