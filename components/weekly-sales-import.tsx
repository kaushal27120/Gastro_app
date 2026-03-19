"use client"

import React, { useState } from 'react'
import { createClient } from '@/app/supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as XLSX from 'xlsx'

type DishMatch = { id: string; dish_name: string; recipe_id: string | null }
type SalesRecord = {
  product_name: string
  qty_sold: number
  gross_sales: number
  net_sales: number
  discount_value: number
  value_without_discounts: number
  profit: number
  cost: number
  matched_dish?: DishMatch | null
}

export function WeeklySalesImport({ locations }: { locations: { id: string; name: string }[] }) {
  const supabase = createClient()

  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesProcessing, setSalesProcessing] = useState(false)
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0])
  const [dishSearchResults, setDishSearchResults] = useState<DishMatch[]>([])

  const handleSalesFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSalesLoading(true)
    const reader = new FileReader()

    reader.onload = async (evt: ProgressEvent<FileReader>) => {
      try {
        const bstr = evt.target?.result as string | ArrayBuffer
        const wb = typeof bstr === 'string'
          ? XLSX.read(bstr, { type: 'binary' })
          : XLSX.read(new Uint8Array(bstr as ArrayBuffer), { type: 'array' })

        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: null }) as Array<Record<string, any>>

        const preview: SalesRecord[] = []
        data.forEach(row => {
          const productRaw = row['Produkt'] ?? row['product'] ?? row['Product']
          if (!productRaw) return
          const qty = Number(row['Ilość sprzedanych'] ?? row['Qty'] ?? row['Quantity'] ?? 0)
          if (!qty || isNaN(qty)) return
          preview.push({
            product_name: String(productRaw).trim(),
            qty_sold: qty,
            gross_sales:              Number(row['Wartość sprzedaży']          ?? 0) || 0,
            net_sales:                Number(row['Wartość sprzedaży netto']    ?? 0) || 0,
            discount_value:           Number(row['Wartość zniżek']             ?? 0) || 0,
            value_without_discounts:  Number(row['Wartość bez zniżek']         ?? 0) || 0,
            profit:                   Number(row['Zysk']                       ?? 0) || 0,
            cost:                     Number(row['Koszt']                      ?? 0) || 0,
          })
        })

        if (preview.length > 0 && selectedLocation) {
          const uniqueNames = Array.from(new Set(preview.map(p => p.product_name.toLowerCase())))
          const nameToDish: Record<string, DishMatch | null> = {}
          for (const name of uniqueNames) {
            const base = name.replace(/\s+/g, ' ').trim()
            const { data: dish } = await supabase
              .from('dishes')
              .select('id, dish_name, recipe_id')
              .eq('location_id', selectedLocation)
              .ilike('dish_name', `%${base}%`)
              .limit(1)
              .maybeSingle()
            nameToDish[base] = dish ? { id: dish.id, dish_name: dish.dish_name, recipe_id: dish.recipe_id } : null
          }
          setSalesRecords(preview.map(p => ({
            ...p,
            matched_dish: nameToDish[p.product_name.toLowerCase().replace(/\s+/g, ' ').trim()] ?? null,
          })))
        } else {
          setSalesRecords(preview)
        }
      } catch (err) {
        alert('Błąd odczytu pliku sprzedaży: ' + String(err))
        setSalesRecords([])
      }
      setSalesLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  const searchDishes = async (query: string) => {
    if (!query.trim() || !selectedLocation) { setDishSearchResults([]); return }
    const { data } = await supabase
      .from('dishes')
      .select('id, dish_name, recipe_id')
      .eq('location_id', selectedLocation)
      .ilike('dish_name', `%${query.trim()}%`)
      .order('dish_name')
      .limit(10)
    setDishSearchResults((data || []).map((d: any) => ({ id: d.id, dish_name: d.dish_name, recipe_id: d.recipe_id })))
  }

  const confirmSalesImport = async () => {
    if (!salesRecords.length) return alert('Brak wierszy sprzedaży do importu')
    if (!selectedLocation)   return alert('Wybierz lokalizację')
    if (!salesDate)          return alert('Wybierz datę sprzedaży')
    setSalesProcessing(true)

    try {
      const dishQty: Record<string, number> = {}
      for (const r of salesRecords) {
        if (r.matched_dish?.id) dishQty[r.matched_dish.id] = (dishQty[r.matched_dish.id] || 0) + r.qty_sold
      }
      const dishIds = Object.keys(dishQty)
      if (!dishIds.length) { alert('Brak dopasowanych dań z menu'); setSalesProcessing(false); return }

      const { data: dishRows }       = await supabase.from('dishes').select('id, recipe_id').in('id', dishIds)
      const recipeIds = Array.from(new Set((dishRows || []).map((d: any) => d.recipe_id).filter(Boolean))) as string[]
      if (!recipeIds.length) { alert('Dania nie mają receptur'); setSalesProcessing(false); return }

      const { data: recipeRows }     = await supabase.from('recipes').select('id, portions').in('id', recipeIds)
      const { data: recipeIngreds }  = await supabase.from('recipe_ingredients').select('recipe_id, ingredient_id, product_id, quantity, unit, source').in('recipe_id', recipeIds)

      const recipesMap        = new Map((recipeRows || []).map((r: any) => [r.id, r]))
      const ingredsByRecipe   = new Map<string, any[]>()
      ;(recipeIngreds || []).forEach((ri: any) => {
        const list = ingredsByRecipe.get(ri.recipe_id) || []
        list.push(ri)
        ingredsByRecipe.set(ri.recipe_id, list)
      })

      const ingUsage = new Map<string, number>(); const ingUnit = new Map<string, string>()
      const prodUsage = new Map<string, number>(); const prodUnit = new Map<string, string>()

      ;(dishRows || []).forEach((d: any) => {
        const portions = Number(recipesMap.get(d.recipe_id)?.portions || 1) || 1
        const totalQty = dishQty[d.id] || 0
        ;(ingredsByRecipe.get(d.recipe_id) || []).forEach((ri: any) => {
          const usage = (Number(ri.quantity) / portions) * totalQty
          if (!usage) return
          const unit = ri.unit || 'pcs'
          if (ri.source === 'product' && ri.product_id) {
            prodUsage.set(ri.product_id, (prodUsage.get(ri.product_id) || 0) + usage)
            if (!prodUnit.has(ri.product_id)) prodUnit.set(ri.product_id, unit)
          } else if (ri.ingredient_id) {
            ingUsage.set(ri.ingredient_id, (ingUsage.get(ri.ingredient_id) || 0) + usage)
            if (!ingUnit.has(ri.ingredient_id)) ingUnit.set(ri.ingredient_id, unit)
          }
        })
      })

      const txs: any[] = []
      ingUsage.forEach((qty, id) => txs.push({ ingredient_id: id, product_id: null, location_id: selectedLocation, tx_type: 'sale', quantity: qty, unit: ingUnit.get(id) || 'pcs', price: null, reference: 'SALES_EXCEL', reason: 'Weekly sales import', created_at: salesDate }))
      prodUsage.forEach((qty, id) => txs.push({ ingredient_id: null, product_id: id, location_id: selectedLocation, tx_type: 'sale', quantity: qty, unit: prodUnit.get(id) || 'pcs', price: null, reference: 'SALES_EXCEL', reason: 'Weekly sales import (product)', created_at: salesDate }))

      if (!txs.length) { alert('Nie wyliczono żadnego zużycia składników'); setSalesProcessing(false); return }

      const { error } = await supabase.from('inventory_transactions').insert(txs)
      if (error) { alert('Błąd zapisu: ' + error.message); setSalesProcessing(false); return }

      alert(`Zaimportowano sprzedaż. Utworzono ${txs.length} transakcji magazynowych.`)
      setSalesRecords([])
    } catch (err) {
      alert('Import nie powiódł się: ' + String(err))
    }
    setSalesProcessing(false)
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Import sprzedaży tygodniowej (Excel)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Wymagane kolumny: <b>Produkt</b>, <b>Ilość sprzedanych</b>, <b>Wartość sprzedaży</b>,
            <b> Wartość zniżek</b>, <b>Zysk</b>, <b>Koszt</b>.
            System dopasuje produkty do dań z menu i wyliczy zużycie składników z receptur.
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Lokalizacja:</span>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm"
              >
                <option value="">Wybierz...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Data (koniec tygodnia):</span>
              <Input type="date" value={salesDate} onChange={e => setSalesDate(e.target.value)} className="w-40" />
            </div>
          </div>

          <Input type="file" accept=".xlsx,.xls" onChange={handleSalesFileUpload} disabled={salesLoading} />
          {salesLoading && <p className="text-sm text-slate-500">Przetwarzanie pliku...</p>}

          {salesRecords.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Podgląd ({salesRecords.length} wierszy)</h3>
              <div className="overflow-auto max-h-72 border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Produkt</th>
                      <th className="px-3 py-2 text-right">Ilość</th>
                      <th className="px-3 py-2 text-left">Dopasowane danie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesRecords.map((r, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{r.product_name}</td>
                        <td className="px-3 py-2 text-right">{r.qty_sold}</td>
                        <td className="px-3 py-2">
                          {r.matched_dish ? (
                            <div className="flex items-center gap-2">
                              <span className="text-green-700 font-medium text-xs">{r.matched_dish.dish_name}</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                                onClick={() => { const c = [...salesRecords]; c[idx].matched_dish = null; setSalesRecords(c) }}>
                                Zmień
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-center">
                              <span className="text-xs text-red-500">Brak dopasowania</span>
                              <Input placeholder="Szukaj dania..." className="h-7 text-xs w-40"
                                onChange={e => searchDishes(e.target.value)} />
                              {dishSearchResults.length > 0 && (
                                <select className="border rounded px-1 py-1 text-xs"
                                  defaultValue=""
                                  onChange={e => {
                                    const match = dishSearchResults.find(d => d.id === e.target.value)
                                    if (!match) return
                                    const c = [...salesRecords]; c[idx].matched_dish = match; setSalesRecords(c)
                                  }}>
                                  <option value="">Wybierz</option>
                                  {dishSearchResults.map(d => <option key={d.id} value={d.id}>{d.dish_name}</option>)}
                                </select>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={confirmSalesImport} disabled={salesProcessing || salesLoading}>
                  {salesProcessing ? 'Zapisywanie...' : 'Zapisz zużycie składników'}
                </Button>
                <Button variant="outline" onClick={() => setSalesRecords([])}>Wyczyść</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
