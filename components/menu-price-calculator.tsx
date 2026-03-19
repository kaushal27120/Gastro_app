'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

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

type Tab = 'calculator' | 'simulator'

function marginStatusCls(pct: number) {
  if (pct >= 65) return 'status-green'
  if (pct >= 50) return 'status-yellow'
  return 'status-red'
}
function marginStatusLabel(pct: number) {
  if (pct >= 65) return 'Zdrowa marża'
  if (pct >= 50) return 'Uwaga — niska'
  return 'Zbyt niska marża'
}
function foodCostColor(pct: number) {
  if (pct <= 30) return 'text-[#16A34A]'
  if (pct <= 38) return 'text-[#CA8A04]'
  return 'text-[#DC2626]'
}
function marginValueColor(pct: number) {
  if (pct >= 65) return 'text-[#16A34A]'
  if (pct >= 50) return 'text-[#CA8A04]'
  return 'text-[#DC2626]'
}

export function MenuPriceCalculator({
  dishName,
  foodCost,
  defaultMarginTarget = 0.7,
  vatRate = 8,
  onPriceChange,
  onSavePrice,
  saving = false,
}: MenuCalculatorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('calculator')
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

  useEffect(() => {
    setCalc(prev => ({ ...prev, foodCost: Number(foodCost) || 0 }))
  }, [foodCost])

  useEffect(() => {
    const suggestedNet   = calc.foodCost / (1 - calc.marginTarget)
    const tax            = suggestedNet * (vatRate / 100)
    const suggestedGross = suggestedNet + tax
    const roundedPrice   = Math.ceil(suggestedGross)
    const finalPrice     = calc.customPrice ?? roundedPrice
    const finalMargin    = (finalPrice - calc.foodCost) / finalPrice
    const foodCostPct    = (calc.foodCost / finalPrice) * 100
    const weeklyRevenue  = finalPrice * calc.weeklySalesCount
    const weeklyProfit   = weeklyRevenue - calc.foodCost * calc.weeklySalesCount

    setCalc(prev => {
      if (
        prev.suggestedPriceGross === suggestedGross &&
        prev.roundedPrice === roundedPrice
      ) return prev
      return {
        ...prev,
        suggestedPriceNet:   parseFloat(suggestedNet.toFixed(2)),
        suggestedPriceGross: parseFloat(suggestedGross.toFixed(2)),
        tax:                 parseFloat(tax.toFixed(2)),
        roundedPrice,
        realFoodCostPct:     parseFloat(foodCostPct.toFixed(1)),
        realMarginPct:       parseFloat((finalMargin * 100).toFixed(1)),
        marginPerUnit:       parseFloat((finalPrice - calc.foodCost).toFixed(2)),
        weeklyRevenue:       parseFloat(weeklyRevenue.toFixed(2)),
        weeklyProfit:        parseFloat(weeklyProfit.toFixed(2)),
      }
    })

    if (onPriceChange && calc.customPrice) onPriceChange(calc.customPrice)
  }, [calc.marginTarget, calc.customPrice, calc.weeklySalesCount, calc.foodCost, vatRate])

  const finalPrice = calc.customPrice ?? calc.roundedPrice
  const TABS: { id: Tab; label: string }[] = [
    { id: 'calculator', label: 'Kalkulator' },
    { id: 'simulator',  label: 'Symulator sprzedaży' },
  ]

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">

      {/* ── Header ─────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-[#E5E7EB]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">
              Kalkulator ceny menu
            </p>
            <h2 className="text-[15px] font-semibold text-[#111827] leading-snug">
              {dishName || '—'}
            </h2>
          </div>
          <span className={marginStatusCls(calc.realMarginPct)}>
            {marginStatusLabel(calc.realMarginPct)}
          </span>
        </div>

        {/* Three KPI tiles */}
        <div className="grid grid-cols-3 gap-px bg-[#E5E7EB] rounded-lg overflow-hidden">
          {[
            {
              label:      'Koszt produkcji',
              value:      `${calc.foodCost.toFixed(2)} zł`,
              sub:        `${calc.realFoodCostPct}% food cost`,
              valueColor: foodCostColor(calc.realFoodCostPct),
            },
            {
              label:      'Marża brutto',
              value:      `${calc.realMarginPct}%`,
              sub:        `${calc.marginPerUnit.toFixed(2)} zł / porcja`,
              valueColor: marginValueColor(calc.realMarginPct),
            },
            {
              label:      'Cena menu',
              value:      `${finalPrice.toFixed(2)} zł`,
              sub:        `netto ${calc.suggestedPriceNet.toFixed(2)} zł`,
              valueColor: 'text-[#111827]',
            },
          ].map(tile => (
            <div key={tile.label} className="bg-white px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF] mb-1">
                {tile.label}
              </p>
              <p className={`text-xl font-bold tabular-nums leading-tight ${tile.valueColor}`}>
                {tile.value}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{tile.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────── */}
      <div className="flex bg-[#F9FAFB] border-b border-[#E5E7EB]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'relative px-5 py-2.5 text-[13px] font-medium transition-colors',
              activeTab === t.id
                ? 'text-[#2563EB] bg-white'
                : 'text-[#6B7280] hover:text-[#374151]',
            ].join(' ')}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#2563EB] rounded-t-sm" />
            )}
          </button>
        ))}
      </div>

      {/* ── Calculator tab ─────────────────────────── */}
      {activeTab === 'calculator' && (
        <div className="p-5 space-y-5">

          {/* Margin slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[12px] font-medium text-[#374151]">
                Docelowa marża brutto
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="0"
                  max="95"
                  step="1"
                  value={Math.round(calc.marginTarget * 100)}
                  onChange={e => {
                    const raw     = Number(e.target.value)
                    const clamped = Number.isFinite(raw) ? Math.min(95, Math.max(0, raw)) : 0
                    setCalc(prev => ({ ...prev, marginTarget: clamped / 100 }))
                  }}
                  className="w-16 h-7 text-center text-[13px] font-bold tabular-nums"
                />
                <span className="text-[13px] font-semibold text-[#374151]">%</span>
              </div>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={calc.marginTarget}
              onChange={e =>
                setCalc(prev => ({ ...prev, marginTarget: parseFloat(e.target.value) }))
              }
              className="w-full accent-[#2563EB] h-1.5 rounded-full cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#9CA3AF]">30%</span>
              <span className="text-[10px] text-[#9CA3AF]">95%</span>
            </div>
          </div>

          {/* Price breakdown table */}
          <div className="rounded-md border border-[#E5E7EB] overflow-hidden">
            <div className="bg-[#F9FAFB] px-4 py-2 border-b border-[#E5E7EB]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Kalkulacja ceny
              </p>
            </div>
            {[
              { label: 'Koszt produkcji',         value: `${calc.foodCost.toFixed(2)} zł`,            muted: false },
              { label: `VAT (${vatRate}%)`,        value: `+ ${calc.tax.toFixed(2)} zł`,              muted: true  },
              { label: 'Sugerowana cena netto',    value: `${calc.suggestedPriceNet.toFixed(2)} zł`,  muted: true  },
              { label: 'Sugerowana cena brutto',   value: `${calc.suggestedPriceGross.toFixed(2)} zł`,muted: false },
            ].map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-2.5 ${i < 3 ? 'border-b border-[#F3F4F6]' : ''}`}
              >
                <span className={`text-[13px] ${row.muted ? 'text-[#6B7280]' : 'text-[#111827] font-medium'}`}>
                  {row.label}
                </span>
                <span className={`text-[13px] tabular-nums ${row.muted ? 'text-[#6B7280]' : 'text-[#111827] font-semibold'}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Quick-round */}
          <button
            onClick={() => setCalc(prev => ({ ...prev, customPrice: calc.roundedPrice }))}
            className="w-full flex items-center justify-between px-3 h-9 rounded-md border border-[#E5E7EB] text-[13px] text-[#374151] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >
            <span>Zaokrąglij do</span>
            <span className="font-bold tabular-nums">{calc.roundedPrice} zł</span>
          </button>

          {/* Custom price */}
          <div>
            <Label className="text-[12px] font-medium text-[#374151] mb-1.5 block">
              Twoja cena w menu
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step="0.5"
                value={calc.customPrice ?? ''}
                onChange={e => {
                  const val = e.target.value ? parseFloat(e.target.value) : null
                  setCalc(prev => ({ ...prev, customPrice: val }))
                }}
                placeholder={String(calc.roundedPrice)}
                className="text-[15px] font-bold tabular-nums h-10"
              />
              <span className="text-[14px] text-[#6B7280] shrink-0">zł</span>
            </div>
          </div>

          {/* Warning */}
          {calc.realFoodCostPct > 40 && (
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-[#FEF9C3] border border-[#FDE68A]">
              <AlertTriangle className="w-4 h-4 text-[#CA8A04] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#92400E]">
                Food cost przekracza 40% — rozważ podniesienie ceny lub optymalizację receptury.
              </p>
            </div>
          )}

          {/* Save CTA */}
          <Button
            className="w-full h-10 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold rounded-md"
            onClick={() => onSavePrice?.(finalPrice, calc.marginTarget)}
            disabled={saving || !Number.isFinite(finalPrice) || finalPrice <= 0}
          >
            {saving ? 'Zapisywanie…' : 'Ustaw cenę menu'}
          </Button>
        </div>
      )}

      {/* ── Simulator tab ──────────────────────────── */}
      {activeTab === 'simulator' && (
        <div className="p-5 space-y-5">

          <div>
            <Label className="text-[12px] font-medium text-[#374151] mb-1.5 block">
              Wolumen sprzedaży tygodniowej
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={calc.weeklySalesCount}
                onChange={e => {
                  const val = Math.max(1, parseInt(e.target.value) || 1)
                  setCalc(prev => ({ ...prev, weeklySalesCount: val }))
                }}
                className="w-24 h-9 text-center text-[15px] font-bold tabular-nums"
              />
              <span className="text-[13px] text-[#6B7280]">porcji / tydzień</span>
            </div>
          </div>

          {/* Weekly breakdown */}
          <div className="rounded-md border border-[#E5E7EB] overflow-hidden">
            <div className="bg-[#F9FAFB] px-4 py-2 border-b border-[#E5E7EB]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Tygodniowo — {calc.weeklySalesCount} porcji
              </p>
            </div>
            {[
              { label: 'Cena sprzedaży',   value: `${finalPrice.toFixed(2)} zł`,                              sub: 'za porcję',   highlight: false },
              { label: 'Przychód brutto',   value: `${calc.weeklyRevenue.toFixed(0)} zł`,                      sub: 'tygodniowo',  highlight: false },
              { label: 'Koszty produkcji',  value: `${(calc.foodCost * calc.weeklySalesCount).toFixed(0)} zł`, sub: 'tygodniowo',  highlight: false },
              { label: 'Zysk brutto',       value: `${calc.weeklyProfit.toFixed(0)} zł`,                       sub: 'tygodniowo',  highlight: true  },
            ].map((row, i) => (
              <div
                key={i}
                className={[
                  'flex items-center justify-between px-4 py-3',
                  i < 3 ? 'border-b border-[#F3F4F6]' : '',
                  row.highlight ? 'bg-[#F0FDF4]' : '',
                ].join(' ')}
              >
                <div>
                  <p className={`text-[13px] font-medium ${row.highlight ? 'text-[#166534]' : 'text-[#111827]'}`}>
                    {row.label}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">{row.sub}</p>
                </div>
                <span className={`text-[15px] font-bold tabular-nums ${row.highlight ? 'text-[#16A34A]' : 'text-[#111827]'}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Monthly projection */}
          <div className="rounded-md border border-[#E5E7EB] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-3">
              Projekcja miesięczna (× 4 tygodnie)
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold tabular-nums text-[#111827]">
                {(calc.weeklyProfit * 4).toFixed(0)} zł
              </span>
              <span className="text-[12px] text-[#6B7280]">zysk brutto</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold tabular-nums text-[#374151]">
                {(calc.weeklyRevenue * 4).toFixed(0)} zł
              </span>
              <span className="text-[12px] text-[#6B7280]">przychód</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
