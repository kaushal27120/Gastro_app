'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Filter, AlertTriangle } from 'lucide-react'

interface DishRecord {
  id: string
  name: string
  category: string
  productionCost: number
  menuPrice: number
  foodCostPct: number
  marginPerServing: number
  marginGoal: number
  marginPct: number
  status: 'ok' | 'warning' | 'critical'
}

interface MenuPricingTableProps {
  dishes?: DishRecord[]
  onSimulation?: (ingredientId: string, priceChange: number) => void
}

export function MenuPricingTable({
  dishes = generateSampleDishes(),
  onSimulation
}: MenuPricingTableProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showProblematic, setShowProblematic] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'foodcost' | 'margin'>('name')
  const [simulationMode, setSimulationMode] = useState(false)
  const [ingredientPriceChange, setIngredientPriceChange] = useState(0)

  // Use useMemo to prevent unnecessary recalculations
  const filteredDishes = useMemo(() => {
    let filtered = [...dishes]

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(d => d.category === selectedCategory)
    }

    if (showProblematic) {
      filtered = filtered.filter(d => d.status !== 'ok')
    }

    if (sortBy === 'foodcost') {
      filtered.sort((a, b) => b.foodCostPct - a.foodCostPct)
    } else if (sortBy === 'margin') {
      filtered.sort((a, b) => b.marginPct - a.marginPct)
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    }

    return filtered
  }, [dishes, selectedCategory, showProblematic, sortBy])

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

  const categories = useMemo(() => {
    return ['all', ...new Set(dishes.map(d => d.category))]
  }, [dishes])

  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="border-b border-[#E5E7EB] mb-5">
        <TabsList className="h-9 bg-transparent p-0 gap-1">
          <TabsTrigger value="overview" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Przegląd wyceny menu</TabsTrigger>
          <TabsTrigger value="simulation" className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-[#EFF6FF] data-[state=active]:text-[#2563EB] data-[state=inactive]:text-[#6B7280]">Symulator wariantów</TabsTrigger>
        </TabsList>
      </div>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-4 mt-0">
        {/* Filters */}
        <div className="flex gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 w-48 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat === 'all' ? 'Wszystkie kategorie' : cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-8 w-44 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sortuj: Nazwa</SelectItem>
              <SelectItem value="foodcost">Sortuj: Koszt prod. %</SelectItem>
              <SelectItem value="margin">Sortuj: Marża %</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setShowProblematic(!showProblematic)}
            className={`h-8 px-3 text-[12px] font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${showProblematic ? 'bg-[#111827] text-white border-[#111827]' : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:text-[#111827]'}`}>
            <Filter size={13} />Tylko problematyczne
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Średni koszt prod.</p>
            <p className="text-[22px] font-bold text-[#2563EB] mt-1">
              {filteredDishes.length ? (filteredDishes.reduce((a, d) => a + d.foodCostPct, 0) / filteredDishes.length).toFixed(1) : '—'}%
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Średnia marża</p>
            <p className="text-[22px] font-bold text-[#16A34A] mt-1">
              {filteredDishes.length ? (filteredDishes.reduce((a, d) => a + d.marginPct, 0) / filteredDishes.length).toFixed(1) : '—'}%
            </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Problematyczne</p>
            <p className="text-[22px] font-bold text-[#DC2626] mt-1">{filteredDishes.filter(d => d.status !== 'ok').length}</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Razem dań</p>
            <p className="text-[22px] font-bold text-[#111827] mt-1">{filteredDishes.length}</p>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB]">
            <p className="text-[13px] font-semibold text-[#111827]">Szczegóły wyceny menu</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 px-4 text-left">Danie</th>
                  <th className="pr-3 text-right">Koszt prod.</th>
                  <th className="pr-3 text-right">Cena menu</th>
                  <th className="pr-3 text-right">Koszt %</th>
                  <th className="pr-3 text-right">Marża / porcja</th>
                  <th className="pr-3 text-right">Marża %</th>
                  <th className="pr-3 text-right">Cel</th>
                  <th className="pr-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDishes.map((dish) => (
                  <tr key={dish.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                    <td className="py-2.5 px-4 font-semibold text-[#111827]">{dish.name}</td>
                    <td className="pr-3 text-right text-[#374151]">{dish.productionCost.toFixed(2)} zł</td>
                    <td className="pr-3 text-right font-semibold text-[#111827]">{dish.menuPrice.toFixed(2)} zł</td>
                    <td className="pr-3 text-right">
                      <span className={`font-semibold ${dish.foodCostPct > 35 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                        {dish.foodCostPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="pr-3 text-right font-semibold text-[#16A34A]">{dish.marginPerServing.toFixed(2)} zł</td>
                    <td className="pr-3 text-right font-semibold text-[#111827]">{dish.marginPct.toFixed(1)}%</td>
                    <td className="pr-3 text-right text-[#6B7280]">{dish.marginGoal}%</td>
                    <td className="pr-4 py-2 text-center">{statusBadge(dish.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      {/* SIMULATION TAB */}
      <TabsContent value="simulation" className="space-y-4 mt-0">
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5">
          <p className="text-[13px] font-semibold text-[#111827] mb-1">Co będzie jeśli zmieni się cena składnika</p>
          <p className="text-[12px] text-[#6B7280] mb-4">Symuluj wpływ zmiany ceny na wszystkie dania zawierające ten składnik</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Składnik</Label>
              <Select>
                <SelectTrigger className="h-8 text-[13px]">
                  <SelectValue placeholder="Wybierz składnik..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="butter">Masło</SelectItem>
                  <SelectItem value="salmon">Łosoś</SelectItem>
                  <SelectItem value="beef">Wołowina</SelectItem>
                  <SelectItem value="potatoes">Ziemniaki</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2 block">Zmiana ceny (%)</Label>
              <div className="flex gap-2">
                <Input type="number" value={ingredientPriceChange} onChange={(e) => setIngredientPriceChange(parseFloat(e.target.value) || 0)} placeholder="+20" className="h-8 text-[13px]" />
                <button onClick={() => setSimulationMode(!simulationMode)} className="h-8 px-3 rounded-lg bg-[#111827] text-white text-[12px] font-medium hover:bg-[#1F2937]">
                  {simulationMode ? 'Wyczyść' : 'Symuluj'}
                </button>
              </div>
            </div>
          </div>

          {simulationMode && ingredientPriceChange !== 0 && (
            <div className="mt-4 bg-[#FFFBEB] border border-[#F59E0B] rounded-lg p-4 flex gap-3">
              <AlertTriangle className="text-[#D97706] shrink-0 mt-0.5 w-4 h-4" />
              <div className="text-[12px] text-[#92400E]">
                <p className="font-semibold mb-1">Symulacja zmiany {ingredientPriceChange > 0 ? '+' : ''}{ingredientPriceChange}%:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>3 dania będą dotknięte</li>
                  <li>Średni koszt produkcji wzrośnie o 2.3%</li>
                  <li>Łosoś Grillowany osiągnie 45% koszt prod. (KRYTYCZNE)</li>
                  <li>Wpływ na zysk miesięczny: -1 240 zł</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB]"><p className="text-[13px] font-semibold text-[#111827]">Wpływ na dania</p></div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="py-2.5 px-4 text-left">Danie</th>
                <th className="pr-3 text-right">Obecny koszt</th>
                <th className="pr-3 text-right">Nowy koszt</th>
                <th className="pr-3 text-right">Zmiana % prod.</th>
                <th className="pr-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#F3F4F6]">
                <td className="py-2.5 px-4 font-semibold text-[#111827]">Łosoś Grillowany</td>
                <td className="pr-3 text-right text-[#374151]">28.10 zł</td>
                <td className="pr-3 text-right font-semibold text-[#111827]">33.72 zł</td>
                <td className="pr-3 text-right text-[#374151]">41.3% → 49.6%</td>
                <td className="pr-4 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626]">
                    Krytyczny
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TabsContent>
    </Tabs>
  )
}

// Sample data generator
function generateSampleDishes(): DishRecord[] {
  return [
    {
      id: '1',
      name: 'Burger Wołowy',
      category: 'Main',
      productionCost: 14.2,
      menuPrice: 42,
      foodCostPct: 33.8,
      marginPerServing: 27.8,
      marginGoal: 30,
      marginPct: 66.2,
      status: 'warning',
    },
    {
      id: '2',
      name: 'Zupa Dnia',
      category: 'Soup',
      productionCost: 3.4,
      menuPrice: 18,
      foodCostPct: 18.9,
      marginPerServing: 14.6,
      marginGoal: 30,
      marginPct: 81.1,
      status: 'ok',
    },
    {
      id: '3',
      name: 'Łosoś Grillowany',
      category: 'Main',
      productionCost: 28.1,
      menuPrice: 68,
      foodCostPct: 41.3,
      marginPerServing: 39.9,
      marginGoal: 30,
      marginPct: 58.7,
      status: 'critical',
    },
    {
      id: '4',
      name: 'Sałatka Cezar',
      category: 'Salad',
      productionCost: 8.5,
      menuPrice: 28,
      foodCostPct: 30.4,
      marginPerServing: 19.5,
      marginGoal: 35,
      marginPct: 69.6,
      status: 'ok',
    },
    {
      id: '5',
      name: 'Steak Wołowy 300g',
      category: 'Main',
      productionCost: 45.0,
      menuPrice: 110,
      foodCostPct: 40.9,
      marginPerServing: 65.0,
      marginGoal: 30,
      marginPct: 59.1,
      status: 'critical',
    },
  ]
}
