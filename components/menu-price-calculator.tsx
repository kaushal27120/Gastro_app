'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, AlertCircle } from 'lucide-react'

interface MenuCalculatorProps {
  dishName: string
  foodCost: number
  defaultMarginTarget?: number
  vatRate?: number
  onPriceChange?: (price: number) => void
  onSavePrice?: (grossPrice: number, marginTarget: number) => void
  saving?: boolean
}

interface CalculatorState {
  foodCost: number
  marginTarget: number
  suggestedPriceNet: number
  suggestedPriceGross: number
  tax: number
  roundedPrice: number
  customPrice: number | null
  realFoodCostPct: number
  realMarginPct: number
  marginPerUnit: number
  weeklySalesCount: number
  weeklyRevenue: number
  weeklyProfit: number
}

export function MenuPriceCalculator({
  dishName,
  foodCost,
  defaultMarginTarget = 0.7,
  vatRate = 8,
  onPriceChange,
  onSavePrice,
  saving = false
}: MenuCalculatorProps) {
  const [calc, setCalc] = useState<CalculatorState>({
    foodCost: Number(foodCost) || 0,
    marginTarget: defaultMarginTarget,
    suggestedPriceNet: 0,
    suggestedPriceGross: 0,
    tax: 0,
    roundedPrice: 0,
    customPrice: null,
    realFoodCostPct: 0,
    realMarginPct: 0,
    marginPerUnit: 0,
    weeklySalesCount: 50,
    weeklyRevenue: 0,
    weeklyProfit: 0,
  })

  // Sync foodCost prop with state
  useEffect(() => {
    setCalc(prev => ({
      ...prev,
      foodCost: Number(foodCost) || 0
    }))
  }, [foodCost])

  // Recalculate when inputs change
  useEffect(() => {
    // Formula: Price = Cost / (1 - margin%)
    // Example: if cost=12.40 and margin target=70%, then price = 12.40 / (1-0.7) = 12.40 / 0.3 = 41.33
    const suggestedNet = calc.foodCost / (1 - calc.marginTarget)
    const tax = suggestedNet * (vatRate / 100)
    const suggestedGross = suggestedNet + tax

    // Round to common ending (9 or round number)
    const roundedPrice = Math.ceil(suggestedGross)

    // Use custom price if provided, otherwise use rounded suggested price
    const finalPrice = calc.customPrice ?? roundedPrice
    const finalNet = finalPrice / (1 + vatRate / 100)
    const finalMargin = (finalPrice - calc.foodCost) / finalPrice
    const foodCostPct = (calc.foodCost / finalPrice) * 100

    // Weekly/monthly calculations
    const weeklyRevenue = finalPrice * calc.weeklySalesCount
    const weeklyCost = calc.foodCost * calc.weeklySalesCount
    const weeklyProfit = weeklyRevenue - weeklyCost

    setCalc(prev => {
      // Only update if values actually changed to prevent infinite loops
      if (prev.suggestedPriceGross === suggestedGross && prev.roundedPrice === roundedPrice) {
        return prev
      }
      return {
        ...prev,
        suggestedPriceNet: parseFloat(suggestedNet.toFixed(2)),
        suggestedPriceGross: parseFloat(suggestedGross.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        roundedPrice: roundedPrice,
        realFoodCostPct: parseFloat(foodCostPct.toFixed(1)),
        realMarginPct: parseFloat((finalMargin * 100).toFixed(1)),
        marginPerUnit: parseFloat((finalPrice - calc.foodCost).toFixed(2)),
        weeklyRevenue: parseFloat(weeklyRevenue.toFixed(2)),
        weeklyProfit: parseFloat(weeklyProfit.toFixed(2)),
      }
    })

    if (onPriceChange && calc.customPrice) {
      onPriceChange(calc.customPrice)
    }
  }, [calc.marginTarget, calc.customPrice, calc.weeklySalesCount, calc.foodCost, vatRate])

  const finalPrice = calc.customPrice ?? calc.roundedPrice
  const getFoodCostColor = (pct: number) => {
    if (pct <= 30) return 'text-green-600'
    if (pct <= 35) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Card className="sticky top-4 bg-white shadow-lg border border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          💰 Kalkulator Ceny Menu
        </CardTitle>
        <CardDescription>{dishName}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Production Cost */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <Label className="text-xs text-gray-600">Koszt produkcji na porcję</Label>
          <div className="text-2xl font-bold text-gray-900">
            {calc.foodCost.toFixed(2)} zł
          </div>
        </div>

        {/* Margin Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Docelowa marża brutto</Label>
            <div className="text-lg font-bold text-blue-600">
              {(calc.marginTarget * 100).toFixed(0)}%
            </div>
          </div>
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={calc.marginTarget}
            onChange={(e) => setCalc(prev => ({ ...prev, marginTarget: parseFloat(e.target.value) }))}
            className="w-full"
          />
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-gray-500">Ustaw procent marży</Label>
            <Input
              type="number"
              min="0"
              max="95"
              step="1"
              value={Math.round(calc.marginTarget * 100)}
              onChange={(e) => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw) ? Math.min(95, Math.max(0, raw)) : 0
                setCalc(prev => ({ ...prev, marginTarget: clamped / 100 }))
              }}
              className="w-20 h-8 text-center text-xs"
            />
          </div>
          <div className="text-xs text-gray-500 flex justify-between">
            <span>30% (ścisłe)</span>
            <span>95% (premium)</span>
          </div>
        </div>

        {/* Suggested Price */}
        <div className="border-t pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-gray-600">Cena netto</div>
              <div className="font-semibold">{calc.suggestedPriceNet.toFixed(2)} zł</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">VAT ({vatRate}%)</div>
              <div className="font-semibold">{calc.tax.toFixed(2)} zł</div>
            </div>
          </div>

          <div className="bg-blue-50 p-2 rounded-lg">
            <div className="text-xs text-blue-700 mb-1">Sugerowana cena brutto</div>
            <div className="text-2xl font-bold text-blue-900">
              {calc.suggestedPriceGross.toFixed(2)} zł
            </div>
          </div>

          {/* Round Helper */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setCalc(prev => ({ ...prev, customPrice: calc.roundedPrice }))}
          >
            Zaokrąglij do →{' '}
            <span className="ml-1 font-bold text-green-600">
              {calc.roundedPrice} zł
            </span>
          </Button>
        </div>

        {/* Custom Price */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm font-medium">Twoja cena w menu (niestandardowa)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.5"
              value={calc.customPrice ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseFloat(e.target.value) : null
                setCalc(prev => ({ ...prev, customPrice: val }))
              }}
              placeholder={calc.roundedPrice.toString()}
              className="text-lg font-bold"
            />
            <span className="flex items-center text-gray-600">zł</span>
          </div>
          <Button
            className="w-full"
            onClick={() => onSavePrice?.(finalPrice, calc.marginTarget)}
            disabled={saving || !Number.isFinite(finalPrice) || finalPrice <= 0}
          >
            {saving ? 'Zapisywanie…' : 'Ustaw cenę menu'}
          </Button>
        </div>

        {/* KPIs */}
        <div className="bg-gray-50 p-3 rounded-lg space-y-2 border-t pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Koszt produkcji %</span>
            <span className={`font-bold ${getFoodCostColor(calc.realFoodCostPct)}`}>
              {calc.realFoodCostPct}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Marża na porcję</span>
            <span className="font-bold text-green-600">{calc.marginPerUnit.toFixed(2)} zł</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Marża brutto %</span>
            <span className="font-bold text-blue-600">{calc.realMarginPct}%</span>
          </div>
        </div>

        {/* Sales Simulator */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm font-medium flex items-center gap-1">
            <TrendingUp size={16} /> Symulator sprzedaży tygodniowej
          </Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="1"
              value={calc.weeklySalesCount}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1)
                setCalc(prev => ({ ...prev, weeklySalesCount: val }))
              }}
              className="w-20 text-center"
            />
            <span className="text-sm text-gray-600">porcji/tydzień</span>
          </div>

          <div className="bg-green-50 p-2 rounded-lg mt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Przychód/tydzień</span>
              <span className="font-bold">{calc.weeklyRevenue.toFixed(0)} zł</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Zysk/tydzień</span>
              <span className="font-bold text-green-700">{calc.weeklyProfit.toFixed(0)} zł</span>
            </div>
          </div>
        </div>

        {/* Alert if unusual foodcost */}
        {calc.realFoodCostPct > 40 && (
          <div className="flex gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertCircle size={16} className="text-yellow-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800">
              Koszt produkcji wysoki — rozważ podniesienie ceny lub optymalizację receptury
            </p>
          </div>
        )}

        {/* Final Price Display */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-lg text-center border-t pt-3">
          <div className="text-xs opacity-90 mb-1">Ostateczna cena menu</div>
          <div className="text-3xl font-bold">{finalPrice.toFixed(2)} zł</div>
        </div>
      </CardContent>
    </Card>
  )
}
