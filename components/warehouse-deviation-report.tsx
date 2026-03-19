'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/supabase-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
      const { data: deviationData, error: devError } = await supabase
        .from('warehouse_deviations')
        .select('*')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('deviation_pct', { ascending: false })

      if (devError) {
        setDeviations([])
        setLoading(false)
        return
      }

      const { data: ingredientData } = await supabase.from('ingredients').select('id, name, category')

      const transformed = (deviationData || []).map((dev: any) => {
        const ingredient = ingredientData?.find((i: any) => i.id === dev.ingredient_id)
        const deviation = dev.actual_usage - dev.theoretical_usage
        const deviationPct = dev.theoretical_usage > 0 ? Math.abs(deviation / dev.theoretical_usage) * 100 : 0

        let status: 'ok' | 'warning' | 'critical' = 'ok'
        if (deviationPct > 20) status = 'critical'
        else if (deviationPct > 10) status = 'warning'

        return {
          id: dev.id,
          ingredient: ingredient?.name || 'Unknown',
          category: ingredient?.category || 'Uncategorized',
          theoreticalUse: dev.theoretical_usage || 0,
          actualUse: dev.actual_usage || 0,
          deviation,
          deviationPct,
          valueZl: dev.deviation_value || 0,
          status,
          type: (deviation > 0 ? 'positive' : 'negative') as 'positive' | 'negative',
        }
      })

      setDeviations(transformed)
    } catch (err) {
      console.error('Error fetching deviations:', err)
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
      ok: { text: 'OK', cls: 'bg-[#F0FDF4] text-[#16A34A]' },
      warning: { text: 'Uwaga', cls: 'bg-[#FFFBEB] text-[#D97706]' },
      critical: { text: 'Krytyczny', cls: 'bg-[#FEF2F2] text-[#DC2626]' },
    }
    const badge = badges[status]
    return (
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${badge.cls}`}>
        {badge.text}
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
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Początek okresu</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-8 text-[13px]" />
          </div>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Koniec okresu</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-8 text-[13px]" />
          </div>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Odśwież</Label>
            <button onClick={fetchDeviations} disabled={loading} className="h-8 px-3 w-full rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB] flex items-center justify-center gap-1.5 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Przeładuj
            </button>
          </div>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5 block">Status</Label>
            <div className="h-8 flex items-center text-[12px]">
              {loading
                ? <span className="text-[#2563EB]">Wczytywanie...</span>
                : <span className="text-[#16A34A] font-medium">{deviations.length} rekordów</span>
              }
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="border-b border-[#E5E7EB] mb-5">
          <TabsList className="h-9 bg-transparent p-0 gap-1">
            <TabsTrigger value="overview" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Lista odchyleń</TabsTrigger>
            <TabsTrigger value="details" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Analiza szczegółowa</TabsTrigger>
            <TabsTrigger value="trends" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Trendy</TabsTrigger>
          </TabsList>
        </div>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Suma odchyleń</p>
              <p className="text-[22px] font-bold text-[#D97706] mt-1">{totalDeviation.toFixed(0)} zł</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">za okres</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Straty</p>
              <p className="text-[22px] font-bold text-[#DC2626] mt-1">{losses.toFixed(0)} zł</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">więcej niż oczekiwano</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Nadwyżka</p>
              <p className="text-[22px] font-bold text-[#16A34A] mt-1">{surplus.toFixed(0)} zł</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">mniej niż zaplanowano</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Krytyczne</p>
              <p className="text-[22px] font-bold text-[#DC2626] mt-1">{critical}</p>
              <p className="text-[11px] text-[#6B7280] mt-0.5">&gt;20% odchylenia</p>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">Odchylenia składników</p>
                <p className="text-[11px] text-[#6B7280]">Zużycie teoretyczne vs rzeczywiste</p>
              </div>
              <button className="h-8 px-3 rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Eksport
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 px-4 text-left">Składnik</th>
                    <th className="pr-3 text-left">Kategoria</th>
                    <th className="pr-3 text-right">Teoretyczne</th>
                    <th className="pr-3 text-right">Rzeczywiste</th>
                    <th className="pr-3 text-right">Odchylenie</th>
                    <th className="pr-3 text-right">%</th>
                    <th className="pr-3 text-right">Wartość (zł)</th>
                    <th className="pr-4 text-center">Status</th>
                    <th className="pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {deviations.map((dev) => (
                    <tr key={dev.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                      <td className="py-2.5 px-4 font-semibold text-[#111827]">{dev.ingredient}</td>
                      <td className="pr-3 text-[#6B7280]">{dev.category}</td>
                      <td className="pr-3 text-right text-[#374151]">12.4 kg</td>
                      <td className="pr-3 text-right font-semibold text-[#111827]">{dev.theoreticalUse + dev.deviation} kg</td>
                      <td className="pr-3 text-right">
                        <span className={dev.type === 'positive' ? 'font-semibold text-[#DC2626]' : 'font-semibold text-[#16A34A]'}>
                          {dev.type === 'positive' ? '+' : '−'}{Math.abs(dev.deviation).toFixed(1)} kg
                        </span>
                      </td>
                      <td className="pr-3 text-right">
                        <span className={dev.deviationPct > 10 ? 'font-bold text-[#DC2626]' : 'text-[#6B7280]'}>
                          {dev.type === 'positive' ? '+' : '−'}{dev.deviationPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="pr-3 text-right font-bold text-[#111827]">{dev.valueZl.toFixed(0)} zł</td>
                      <td className="pr-4 py-2 text-center">{statusBadge(dev.status)}</td>
                      <td className="pr-3">
                        <button
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] text-[#6B7280]"
                          onClick={() => {
                            setSelectedDeviation(selectedDeviation === dev.id ? null : dev.id)
                            setShowDetails(prev => ({ ...prev, [dev.id]: !prev[dev.id] }))
                          }}
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${showDetails[dev.id] ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DETAILS TAB */}
        <TabsContent value="details" className="space-y-4 mt-0">
          {deviations.filter(d => d.status === 'critical').map((dev) => (
            <div key={dev.id} className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FEF2F2] flex items-start justify-between">
                <div>
                  <p className="text-[14px] font-bold text-[#111827] flex items-center gap-2">
                    {dev.ingredient}
                    <span className="text-[13px] font-semibold text-[#DC2626]">
                      {dev.type === 'positive' ? '+' : '−'}{dev.deviationPct.toFixed(1)}%
                    </span>
                  </p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    Odchylenie: {dev.type === 'positive' ? '+' : '−'}{Math.abs(dev.deviation).toFixed(1)} kg ({dev.valueZl.toFixed(0)} zł)
                  </p>
                </div>
                {statusBadge(dev.status)}
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#3B82F6] mb-3">Zużycie teoretyczne</p>
                    <div className="space-y-1.5 text-[12px]">
                      <div className="flex justify-between text-[#374151]"><span>Łosoś Grillowany (48 szt)</span><span className="font-semibold">9.60 kg</span></div>
                      <div className="flex justify-between text-[#374151]"><span>Sałatka z łososiem (14 szt)</span><span className="font-semibold">1.40 kg</span></div>
                      <div className="flex justify-between text-[#374151]"><span>Zupa rybna (7 szt)</span><span className="font-semibold">1.40 kg</span></div>
                      <div className="border-t border-[#BFDBFE] pt-1.5 flex justify-between font-bold text-[#111827]"><span>RAZEM</span><span>12.40 kg</span></div>
                    </div>
                  </div>

                  <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#16A34A] mb-3">Zużycie rzeczywiste</p>
                    <div className="space-y-1.5 text-[12px]">
                      <div className="flex justify-between text-[#374151]"><span>Stan otwarcia (01.02)</span><span className="font-semibold">8.20 kg</span></div>
                      <div className="flex justify-between text-[#374151]"><span>+ Dostawa FV/2026/014</span><span className="font-semibold">+10.00 kg</span></div>
                      <div className="flex justify-between text-[#374151]"><span>+ Dostawa FV/2026/021</span><span className="font-semibold">+8.00 kg</span></div>
                      <div className="flex justify-between text-[#374151]"><span>− Stan zamknięcia (19.02)</span><span className="font-semibold">−1.10 kg</span></div>
                      <div className="border-t border-[#BBF7D0] pt-1.5 flex justify-between font-bold text-[#111827]"><span>ZUŻYCIE</span><span>15.10 kg</span></div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#FFFBEB] border border-[#F59E0B] rounded-lg p-4 flex gap-3">
                  <AlertCircle className="text-[#D97706] shrink-0 mt-0.5 w-4 h-4" />
                  <div className="text-[12px] text-[#92400E]">
                    <p className="font-semibold mb-1">Duże odchylenie (+21.8%). Możliwe przyczyny:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {possibleCauses(dev.ingredient).map((cause, idx) => (
                        <li key={idx}>{cause}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Notatki wyjaśniające</p>
                  <Textarea
                    placeholder="Po rozmowie z personelem kuchni... (tworzy ślad audytu)"
                    value={explanationNotes[dev.id] || ''}
                    onChange={(e) => setExplanationNotes({ ...explanationNotes, [dev.id]: e.target.value })}
                    rows={3}
                    className="text-[13px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onExplain?.(dev.id, explanationNotes[dev.id] || '')
                        setExplanationNotes({ ...explanationNotes, [dev.id]: '' })
                      }}
                      className="h-8 px-4 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937]"
                    >
                      Oznacz jako wyjaśnione
                    </button>
                    <button className="h-8 px-4 rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB]">
                      Historia
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* TRENDS TAB */}
        <TabsContent value="trends" className="space-y-4 mt-0">
          {deviations.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-lg py-12 text-center">
              <p className="text-[13px] text-[#6B7280]">Brak danych odchyleń do wyświetlenia</p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#6B7280]" />
                  <p className="text-[13px] font-semibold text-[#111827]">Top odchylenia</p>
                </div>
                <div className="p-5 space-y-4">
                  {deviations
                    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))
                    .slice(0, 5)
                    .map((dev, idx) => (
                      <div key={dev.id} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-[#9CA3AF] w-5">#{idx + 1}</span>
                            <div>
                              <p className="text-[13px] font-semibold text-[#111827]">{dev.ingredient}</p>
                              <p className="text-[11px] text-[#6B7280]">{dev.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-[13px] font-bold ${dev.type === 'positive' ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                              {dev.type === 'positive' ? '+' : '−'}{dev.deviationPct.toFixed(1)}%
                            </p>
                            <p className="text-[11px] text-[#6B7280]">{dev.type === 'positive' ? '+' : '−'}{Math.abs(dev.deviation).toFixed(1)} j.m.</p>
                          </div>
                        </div>
                        <div className="w-full bg-[#F3F4F6] rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${dev.type === 'positive' ? 'bg-[#DC2626]' : 'bg-[#16A34A]'}`}
                            style={{ width: `${Math.min(dev.deviationPct, 100)}%` }}
                          />
                        </div>
                        <p className={`text-[11px] ${dev.status === 'critical' ? 'text-[#DC2626]' : dev.status === 'warning' ? 'text-[#D97706]' : 'text-[#16A34A]'}`}>
                          {dev.status === 'critical' && 'Krytyczne'}
                          {dev.status === 'warning' && 'Ostrzeżenie'}
                          {dev.status === 'ok' && 'W normie'}
                          {dev.type === 'positive' && ' — możliwa strata lub błąd receptury'}
                          {dev.type === 'negative' && ' — mniej zużycia niż oczekiwano'}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 text-center">
                  <p className="text-[22px] font-bold text-[#DC2626]">{deviations.filter(d => d.status === 'critical').length}</p>
                  <p className="text-[12px] font-semibold text-[#DC2626] mt-0.5">Krytyczne</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {deviations.filter(d => d.status === 'critical').length > 0
                      ? `${((deviations.filter(d => d.status === 'critical').length / deviations.length) * 100).toFixed(0)}% składników`
                      : 'Brak'}
                  </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 text-center">
                  <p className="text-[22px] font-bold text-[#D97706]">{deviations.filter(d => d.status === 'warning').length}</p>
                  <p className="text-[12px] font-semibold text-[#D97706] mt-0.5">Ostrzeżenia</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {deviations.filter(d => d.status === 'warning').length > 0
                      ? `${((deviations.filter(d => d.status === 'warning').length / deviations.length) * 100).toFixed(0)}% składników`
                      : 'Brak'}
                  </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 text-center">
                  <p className="text-[22px] font-bold text-[#16A34A]">{deviations.filter(d => d.status === 'ok').length}</p>
                  <p className="text-[12px] font-semibold text-[#16A34A] mt-0.5">W normie</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    {deviations.filter(d => d.status === 'ok').length > 0
                      ? `${((deviations.filter(d => d.status === 'ok').length / deviations.length) * 100).toFixed(0)}% składników`
                      : 'Brak'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                  <p className="text-[22px] font-bold text-[#DC2626]">{deviations.filter(d => d.type === 'positive').length}</p>
                  <p className="text-[12px] font-semibold text-[#DC2626] mt-0.5">Straty / Nadmierne zużycie</p>
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    Łącznie: {deviations.filter(d => d.type === 'positive').reduce((sum, d) => sum + d.valueZl, 0).toFixed(0)} zł
                  </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                  <p className="text-[22px] font-bold text-[#16A34A]">{deviations.filter(d => d.type === 'negative').length}</p>
                  <p className="text-[12px] font-semibold text-[#16A34A] mt-0.5">Nadwyżki / Mniej zużycia</p>
                  <p className="text-[12px] text-[#6B7280] mt-1">
                    Łącznie: {Math.abs(deviations.filter(d => d.type === 'negative').reduce((sum, d) => sum + d.valueZl, 0)).toFixed(0)} zł
                  </p>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
