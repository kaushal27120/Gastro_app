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

  const categories = useMemo(() => {
    return ['all', ...new Set(dishes.map(d => d.category))]
  }, [dishes])

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="overview">Przegląd wyceny menu</TabsTrigger>
        <TabsTrigger value="simulation">Symulator wariantów</TabsTrigger>
      </TabsList>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-4">
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label className="text-sm font-medium mb-2 block">Kategoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === 'all' ? 'Wszystkie kategorie' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-sm font-medium mb-2 block">Sortuj wg</Label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nazwa</SelectItem>
                  <SelectItem value="foodcost">Koszt produkcji %</SelectItem>
                  <SelectItem value="margin">Marża %</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={showProblematic ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowProblematic(!showProblematic)}
              className="gap-2"
            >
              <Filter size={16} />
              Tylko problematyczne
            </Button>

            <Button variant="outline" size="sm" className="gap-2">
              <Download size={16} />
              Eksport
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Średni koszt produkcji</div>
              <div className="text-2xl font-bold text-blue-600">
                {(filteredDishes.reduce((a, d) => a + d.foodCostPct, 0) / filteredDishes.length).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Średnia marża</div>
              <div className="text-2xl font-bold text-green-600">
                {(filteredDishes.reduce((a, d) => a + d.marginPct, 0) / filteredDishes.length).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Problematyczne dania</div>
              <div className="text-2xl font-bold text-red-600">
                {filteredDishes.filter(d => d.status !== 'ok').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Razem dań</div>
              <div className="text-2xl font-bold text-gray-900">{filteredDishes.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card>
          <CardHeader>
            <CardTitle>Szczegóły wyceny menu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold">Nazwa dania</th>
                    <th className="text-left p-3 font-semibold">Koszt produkcji</th>
                    <th className="text-left p-3 font-semibold">Cena menu</th>
                    <th className="text-left p-3 font-semibold">Koszt prod. %</th>
                    <th className="text-left p-3 font-semibold">Marża / porcja</th>
                    <th className="text-left p-3 font-semibold">Marża %</th>
                    <th className="text-left p-3 font-semibold">Cel</th>
                    <th className="text-center p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDishes.map((dish) => (
                    <tr key={dish.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{dish.name}</td>
                      <td className="p-3">{dish.productionCost.toFixed(2)} zł</td>
                      <td className="p-3 font-semibold">{dish.menuPrice.toFixed(2)} zł</td>
                      <td className="p-3">
                        <span className={dish.foodCostPct > 35 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          {dish.foodCostPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-green-600 font-semibold">
                        {dish.marginPerServing.toFixed(2)} zł
                      </td>
                      <td className="p-3 font-semibold">{dish.marginPct.toFixed(1)}%</td>
                      <td className="p-3 text-gray-600">{dish.marginGoal}%</td>
                      <td className="p-3 text-center">{statusBadge(dish.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* SIMULATION TAB */}
      <TabsContent value="simulation" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Co będzie jeśli zmieni się cena składnika</CardTitle>
            <CardDescription>
              Symuluj wpływ zmiany ceny na wszystkie dania zawierające ten składnik
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Wybierz składnik</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz składnik..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="butter">Masło (Butter)</SelectItem>
                    <SelectItem value="salmon">Łosoś (Salmon)</SelectItem>
                    <SelectItem value="beef">Wołowina (Beef)</SelectItem>
                    <SelectItem value="potatoes">Ziemniaki (Potatoes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Zmiana ceny (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={ingredientPriceChange}
                    onChange={(e) => setIngredientPriceChange(parseFloat(e.target.value) || 0)}
                    placeholder="np. +20"
                    className="text-lg"
                  />
                  <Button onClick={() => setSimulationMode(!simulationMode)}>
                    {simulationMode ? 'Wyczyść' : 'Symuluj'}
                  </Button>
                </div>
              </div>
            </div>

            {simulationMode && ingredientPriceChange !== 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex gap-3">
                  <AlertTriangle className="text-yellow-700 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-2">
                      Symulacja zmiany ceny {ingredientPriceChange > 0 ? '+' : ''}{ingredientPriceChange}%:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>3 dania będą dotkniete</li>
                      <li>Średni koszt produkcji wzrośnie o 2.3%</li>
                      <li>Łosoś Grillowany koszt prod. osiągnie 45% (KRYTYCZNE)</li>
                      <li>Wpływ na zysk miesięczny: -1,240 zł</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">Wpływ na dania:</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Danie</th>
                    <th className="text-right p-2 font-semibold">Obecny koszt</th>
                    <th className="text-right p-2 font-semibold">Nowy koszt</th>
                    <th className="text-right p-2 font-semibold">Zmiana % prod.</th>
                    <th className="text-center p-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">Łosoś Grillowany</td>
                    <td className="text-right p-2">28.10 zł</td>
                    <td className="text-right p-2 font-semibold">33.72 zł</td>
                    <td className="text-right p-2">41.3% → 49.6%</td>
                    <td className="text-center p-2">
                      <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 font-semibold">
                        ⚠️ KRYTYCZNE
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
