"use client"
import React, { useState, useEffect } from 'react'
import { createClient } from '@/app/supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import IngredientAutocomplete from '@/components/ingredient-autocomplete'
import * as XLSX from 'xlsx' // Requires: npm install xlsx

export default function ImportPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'cost' | 'sales'>('cost')
  const [salesDate, setSalesDate] = useState<string>(new Date().toISOString().split('T')[0])
  type LocationRow = { id: string; name: string }
  type IngredientMatch = { id: string; name: string; unit?: string; last_price?: number }
  type ParsedRecord = {
    cost_date: string
    supplier: string
    account_description: string
    amount: number
    cost_type: string
    source: string
    product_name: string
    quantity: number
    unit: string
    sale_date: string
    // Optional sales-specific fields
    gross_sales?: number
    net_sales?: number
    discount_value?: number
    original_value?: number
    profit_value?: number
    cost_value?: number
    override_ingredient_id: string | null
    matched_ingredient?: IngredientMatch | null
  }

  const [locations, setLocations] = useState<LocationRow[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [productCol, setProductCol] = useState('D')
  const [quantityCol, setQuantityCol] = useState('Q')
  const [priceCol, setPriceCol] = useState('S')
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([])
  const [processingPreview, setProcessingPreview] = useState(false)
  const [dishesByName, setDishesByName] = useState<Record<string, { id: string; recipe_id: string }>>({})
  type SalesSummaryItem = { productName: string; soldQty: number; matchedDish?: string | null; ingredients?: { name: string; qty: number; unit: string }[] }
  const [salesSummary, setSalesSummary] = useState<SalesSummaryItem[]>([])
  
  useEffect(() => {
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLocations([])
          return
        }

        const res = await supabase
          .from('locations')
          .select('id,name')
          .eq('company_id', profile.company_id)

        const data = res.data as LocationRow[] | null
        setLocations(data || [])
        if (data && data.length === 1) setSelectedLocation(data[0].id)

        // Preload dishes for recipe mapping (for all locations of this company)
        const { data: dishes } = await supabase
          .from('dishes')
          .select('id, recipe_id, dish_name')
          .eq('company_id', profile.company_id)

        const mapping: Record<string, { id: string; recipe_id: string }> = {}
        ;(dishes || []).forEach((d: any) => {
          if (!d.dish_name) return
          const key = String(d.dish_name).toLowerCase().trim()
          if (!mapping[key]) mapping[key] = { id: d.id, recipe_id: d.recipe_id }
        })
        setDishesByName(mapping)
      } catch (err) {
        console.warn('Could not fetch locations', err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When sales preview is ready, precompute ingredient-level usage summary for user visibility
  useEffect(() => {
    const buildSalesSummary = async () => {
      if (mode !== 'sales' || !parsedRecords.length) {
        setSalesSummary([])
        return
      }

      // Aggregate sold qty per product name
      const dishQty: Record<string, number> = {}
      parsedRecords.forEach(r => {
        const key = (r.product_name || '').toLowerCase().trim()
        if (!key) return
        dishQty[key] = (dishQty[key] || 0) + (r.quantity || 0)
      })

      const entries = Object.entries(dishQty)
      if (!entries.length) {
        setSalesSummary([])
        return
      }

      const result: { productName: string; soldQty: number; matchedDish?: string | null; ingredients?: { name: string; qty: number; unit: string }[] }[] = []

      for (const [key, qty] of entries) {
        const dish = dishesByName[key]
        if (!dish?.recipe_id) {
          result.push({ productName: key, soldQty: qty, matchedDish: null, ingredients: [] })
          continue
        }

        const { data: recipeItems, error } = await supabase
          .from('recipe_ingredients')
          .select('quantity, unit, ingredients(name)')
          .eq('recipe_id', dish.recipe_id)

        if (error) {
          console.warn('Error loading recipe for summary', key, error)
          result.push({ productName: key, soldQty: qty, matchedDish: key, ingredients: [] })
          continue
        }

        const ingList = (recipeItems || []).map((item: any) => {
          const perPortion = Number(item.quantity || 0)
          const totalQty = perPortion * qty
          const name = Array.isArray(item.ingredients) ? item.ingredients[0]?.name : item.ingredients?.name
          return {
            name: name || 'Unknown',
            qty: Number(totalQty.toFixed(3)),
            unit: item.unit || 'kg',
          }
        })

        result.push({ productName: key, soldQty: qty, matchedDish: key, ingredients: ingList })
      }

      setSalesSummary(result)
    }

    buildSalesSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, parsedRecords, dishesByName])
  
  // Logic to classify COS vs SEMIS based on "RK" Description
  const classifyCost = (rk: string) => {
    const lower = rk.toLowerCase()
    // Define your mapping rules here
    if (lower.includes('food') || lower.includes('bev') || lower.includes('meat') || lower.includes('produce')) {
      return 'COS'
    }
    return 'SEMIS' // Default to Operating Expense
  }

  // Helper to convert Excel Serial Date to JS Date
  const excelDateToJSDate = (serial: number) => {
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                                        
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const reader = new FileReader()
    
    reader.onload = async (evt: ProgressEvent<FileReader>) => {
      const bstr = evt.target?.result as string | ArrayBuffer
      let wb
      if (typeof bstr === 'string') {
        wb = XLSX.read(bstr, { type: 'binary' })
      } else {
        wb = XLSX.read(new Uint8Array(bstr as ArrayBuffer), { type: 'array' })
      }
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]

      if (mode === 'cost') {
        // Existing COST import logic (unchanged)
        const data = XLSX.utils.sheet_to_json(ws, { header: 'A' }) as Array<Record<string, unknown>>

        const preview: ParsedRecord[] = []
        data.forEach((row) => {
          const dateCell = row['E']
          const priceCell = row[priceCol]
          if (!dateCell || !priceCell) return
          const saleDateRaw = dateCell
          let finalDate = String(saleDateRaw)
          if (typeof saleDateRaw === 'number') finalDate = excelDateToJSDate(saleDateRaw)
          const supplier = (row['G'] as string) || 'Unknown'
          const rk = (row['RK'] as string) || (row['H'] as string) || ''
          const amount = Number(priceCell as unknown)
          const productName = row[productCol] as string | undefined
          const qty = row[quantityCol] as number | undefined
          const costType = classifyCost(String(rk))
          if (!amount) return
          preview.push({
            cost_date: finalDate,
            supplier: String(supplier),
            account_description: String(rk),
            amount: Number(amount),
            cost_type: costType,
            source: 'IMPORT_EXCEL',
            product_name: productName ? String(productName) : '',
            quantity: qty ? Number(qty) : 1,
            unit: (row['U'] as string) || '',
            sale_date: finalDate,
            override_ingredient_id: null,
          })
        })

        if (preview.length > 0) {
          const uniqueNames = Array.from(new Set(preview.map(p => (p.product_name || '').toLowerCase()).filter(Boolean)))
          const lookups = await Promise.all(uniqueNames.map(n => supabase.from('ingredients').select('id,unit,last_price,name').ilike('name', `%${n}%`).limit(1).maybeSingle()))
          const nameToIngredient: Record<string, ParsedRecord['matched_ingredient'] | null> = {}
          lookups.forEach((r: any, idx: number) => { if (r && r.data) nameToIngredient[uniqueNames[idx]] = r.data as ParsedRecord['matched_ingredient'] })
          const mapped = preview.map(p => ({ ...p, matched_ingredient: nameToIngredient[(p.product_name || '').toLowerCase()] || null }))
          setParsedRecords(mapped)
        } else {
          setParsedRecords(preview)
        }
      } else {
        // SALES import: expect headers like "Produkt", "Ilość sprzedanych", "Wartość sprzedaży", "Wartość sprzedaży netto", "Wartość zniżek", "Wartość bez zniżek", "Zysk", "Koszt"
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Array<any[]>
        if (!rows.length) {
          setParsedRecords([])
          setLoading(false)
          return
        }

        const header = rows[0].map(h => String(h || '').trim().toLowerCase())
        const findIdx = (needle: string) => header.findIndex(h => h.includes(needle))

        const productIdx = findIdx('produkt')
        const qtyIdx = findIdx('ilość sprzedanych')
        const grossIdx = findIdx('wartość sprzedaży')
        const netIdx = findIdx('wartość sprzedaży netto')
        const discountIdx = findIdx('wartość zniżek')
        const originalIdx = findIdx('wartość bez zniżek')
        const profitIdx = findIdx('zysk')
        const costIdx = findIdx('koszt')

        if (productIdx === -1 || qtyIdx === -1) {
          alert('Nie mogę znaleźć kolumn "Produkt" lub "Ilość sprzedanych" w pliku Excel.')
          setParsedRecords([])
          setLoading(false)
          return
        }

        const preview: ParsedRecord[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row) continue
          const productName = row[productIdx]
          const qtyRaw = row[qtyIdx]
          if (!productName || !qtyRaw) continue

          const quantity = Number(qtyRaw) || 0
          if (!quantity) continue

          const gross = grossIdx !== -1 ? Number(row[grossIdx] || 0) : 0
          const net = netIdx !== -1 ? Number(row[netIdx] || 0) : 0
          const discount = discountIdx !== -1 ? Number(row[discountIdx] || 0) : 0
          const originalVal = originalIdx !== -1 ? Number(row[originalIdx] || 0) : 0
          const profit = profitIdx !== -1 ? Number(row[profitIdx] || 0) : 0
          const cost = costIdx !== -1 ? Number(row[costIdx] || 0) : 0

          preview.push({
            cost_date: salesDate,
            supplier: '',
            account_description: 'SALES_IMPORT',
            amount: net || gross || originalVal,
            cost_type: 'SALES',
            source: 'SALES_EXCEL',
            product_name: String(productName),
            quantity,
            unit: 'pcs',
            sale_date: salesDate,
            override_ingredient_id: null,
            gross_sales: gross,
            net_sales: net,
            discount_value: discount,
            original_value: originalVal,
            profit_value: profit,
            cost_value: cost,
          })
        }

        if (preview.length > 0) {
          // For sales we primarily map to dishes by name; ingredient override is still available as fallback
          const uniqueNames = Array.from(new Set(preview.map(p => (p.product_name || '').toLowerCase()).filter(Boolean)))
          const lookups = await Promise.all(uniqueNames.map(n => supabase.from('ingredients').select('id,unit,last_price,name').ilike('name', `%${n}%`).limit(1).maybeSingle()))
          const nameToIngredient: Record<string, ParsedRecord['matched_ingredient'] | null> = {}
          lookups.forEach((r: any, idx: number) => { if (r && r.data) nameToIngredient[uniqueNames[idx]] = r.data as ParsedRecord['matched_ingredient'] })
          const mapped = preview.map(p => ({ ...p, matched_ingredient: nameToIngredient[(p.product_name || '').toLowerCase()] || null }))
          setParsedRecords(mapped)
        } else {
          setParsedRecords(preview)
        }
      }
      setLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  const confirmImport = async () => {
    if (!parsedRecords.length) return alert('No records to import')
    if (!selectedLocation) return alert('Select a location')
    setProcessingPreview(true)
    try {
      if (mode === 'cost') {
        const resolvedInventory: Array<Record<string, unknown>> = []
        const resolvedPrices: Array<Record<string, unknown>> = []
        // resolve ingredient ids from matched or overrides
        for (const r of parsedRecords) {
          const prod = (r.override_ingredient_id || r.matched_ingredient?.id) || null
          if (prod) {
            resolvedInventory.push({
              ingredient_id: prod,
              location_id: selectedLocation,
              tx_type: 'invoice_in',
              quantity: r.quantity || 1,
              unit: r.unit || 'pcs',
              price: r.amount,
              reference: 'IMPORT_EXCEL',
              created_at: r.sale_date,
            })
            resolvedPrices.push({
              ingredient_id: prod,
              price: r.amount,
              unit: r.unit || '',
              supplier: r.supplier || null,
              invoice_ref: null,
              recorded_at: r.sale_date,
            })
          }
        }
        if (resolvedInventory.length) await supabase.from('inventory_transactions').insert(resolvedInventory)
        if (resolvedPrices.length) {
          await supabase.from('ingredient_prices_history').insert(resolvedPrices)
          await Promise.all(resolvedPrices.map(p => supabase.from('ingredients').update({ last_price: p.price }).eq('id', p.ingredient_id)))
          // Call server-side RPC to create alerts for significant price changes
          try {
            await supabase.rpc('check_price_changes', { price_history_json: resolvedPrices, price_change_threshold: 0.1, location_id: selectedLocation })
          } catch (rpcErr) {
            console.warn('Price check RPC failed', rpcErr)
          }
        }
        alert(`Imported ${parsedRecords.length} rows. Created ${resolvedInventory.length} inventory transactions and ${resolvedPrices.length} price history records.`)
      } else {
        // SALES mode: explode sold dishes into ingredient usage using recipes
        if (!selectedLocation) {
          alert('Select a location')
          setProcessingPreview(false)
          return
        }

        // Aggregate sold quantity per dish name
        const dishQty: Record<string, number> = {}
        for (const r of parsedRecords) {
          const nameKey = (r.product_name || '').toLowerCase().trim()
          if (!nameKey) continue
          dishQty[nameKey] = (dishQty[nameKey] || 0) + (r.quantity || 0)
        }

        const uniqueDishKeys = Object.keys(dishQty)
        if (!uniqueDishKeys.length) {
          alert('No sales rows with product names found.')
          setProcessingPreview(false)
          return
        }

        // For each sold dish, load its recipe_ingredients once
        const allSalesTxs: Array<Record<string, unknown>> = []
        for (const key of uniqueDishKeys) {
          const dish = dishesByName[key]
          if (!dish?.recipe_id) {
            console.warn('No dish/recipe found for sold product', key)
            continue
          }

          const soldQty = dishQty[key]
          if (!soldQty) continue

          const { data: recipeItems, error } = await supabase
            .from('recipe_ingredients')
            .select('ingredient_id, quantity, unit')
            .eq('recipe_id', dish.recipe_id)

          if (error) {
            console.warn('Error loading recipe ingredients for dish', key, error)
            continue
          }

          ;(recipeItems || []).forEach((item: any) => {
            const perPortionQty = Number(item.quantity || 0)
            if (!perPortionQty) return
            const totalQty = perPortionQty * soldQty

            allSalesTxs.push({
              ingredient_id: item.ingredient_id,
              location_id: selectedLocation,
              tx_type: 'sale_out',
              quantity: totalQty,
              unit: item.unit || 'kg',
              price: null,
              reference: 'SALES_IMPORT',
              created_at: salesDate,
              reason: `Sales of dish ${key} (${soldQty} pcs)`,
            })
          })
        }

        if (!allSalesTxs.length) {
          alert('No recipe-based sales transactions created. Ensure dishes are defined and names match the sales file.')
        } else {
          await supabase.from('inventory_transactions').insert(allSalesTxs)
          alert(`Imported ${parsedRecords.length} rows. Created ${allSalesTxs.length} ingredient-level sales transactions from recipes.`)
        }
      }
      setParsedRecords([])
    } catch (err) {
      console.error(err)
      alert('Import failed: ' + String(err))
    }
    setProcessingPreview(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Excel Import</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'cost' ? 'Upload Wide Invoice Records (Costs)' : 'Upload Weekly Sales File'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 items-center mb-2">
              <Button
                variant={mode === 'cost' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('cost')}
              >
                Costs / Invoices
              </Button>
              <Button
                variant={mode === 'sales' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('sales')}
              >
                Weekly Sales
              </Button>
            </div>

            {mode === 'cost' ? (
              <p className="text-sm text-gray-500">Mapping: Col E (Date) | Col G (Supplier) | Col RK (Account) | Col S (Amount)</p>
            ) : (
              <p className="text-sm text-gray-500">
                Expected headers: Produkt, Ilość sprzedanych, Wartość sprzedaży, Wartość sprzedaży netto, Wartość zniżek,
                Wartość bez zniżek, Zysk, Koszt (first row in the sheet).
              </p>
            )}
            <div className="flex gap-2 items-center">
              <label className="text-sm">Location:</label>
              <select value={selectedLocation || ''} onChange={e => setSelectedLocation(e.target.value)}>
                <option value="">Select location</option>
                {locations.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
              {mode === 'cost' && (
                <>
                  <label className="text-sm">Product Col:</label>
                  <Input value={productCol} onChange={e => setProductCol(e.target.value.toUpperCase())} />
                  <label className="text-sm">Qty Col:</label>
                  <Input value={quantityCol} onChange={e => setQuantityCol(e.target.value.toUpperCase())} />
                  <label className="text-sm">Price Col:</label>
                  <Input value={priceCol} onChange={e => setPriceCol(e.target.value.toUpperCase())} />
                </>
              )}
              {mode === 'sales' && (
                <>
                  <label className="text-sm">Sales Date:</label>
                  <Input
                    type="date"
                    value={salesDate}
                    onChange={e => setSalesDate(e.target.value)}
                  />
                </>
              )}
            </div>
            <Input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={loading} />
            {loading && <p>Processing...</p>}
            {parsedRecords.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Preview ({parsedRecords.length})</h3>
                <div className="overflow-auto max-h-64 border rounded">
                  <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b"><th className="p-2">Product</th><th>Qty</th><th>Price</th><th>Matched Ingredient</th></tr></thead>
                    <tbody>
                      {parsedRecords.map((r, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{r.product_name || '—'}</td>
                          <td className="p-2">{r.quantity}</td>
                          <td className="p-2">{r.amount}</td>
                          <td className="p-2">
                            {r.matched_ingredient ? (
                              <div className="flex items-center gap-2"><div className="text-sm font-medium">{r.matched_ingredient.name}</div>
                                <Button size="sm" variant="ghost" onClick={() => { const copy = [...parsedRecords]; copy[idx].override_ingredient_id = null; setParsedRecords(copy) }}>Clear</Button></div>
                            ) : (
                              <IngredientAutocomplete
                                value={r.product_name}
                                onChange={(v: string) => { const copy = [...parsedRecords]; copy[idx].product_name = v; setParsedRecords(copy) }}
                                onSelect={(ing) => { const copy = [...parsedRecords]; copy[idx].override_ingredient_id = ing.id; setParsedRecords(copy) }}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {mode === 'sales' && salesSummary.length > 0 && (
                  <div className="mt-4 border rounded p-3 bg-slate-50 text-xs">
                    <div className="font-semibold mb-2">Sales → Ingredient impact (per file)</div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {salesSummary.map(row => (
                        <div key={row.productName} className="border-b pb-2 last:border-b-0">
                          <div className="flex justify-between">
                            <span className="font-medium">{row.productName}</span>
                            <span>{row.soldQty} pcs sold</span>
                          </div>
                          {row.matchedDish ? (
                            row.ingredients && row.ingredients.length ? (
                              <ul className="list-disc pl-5 mt-1">
                                {row.ingredients.map((ing, idx) => (
                                  <li key={idx}>{ing.name}: {ing.qty} {ing.unit}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-slate-500 mt-1">Recipe found but no ingredients listed.</p>
                            )
                          ) : (
                            <p className="text-red-600 mt-1">No matching dish/recipe found for this product name.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button onClick={confirmImport} disabled={processingPreview || loading}>Confirm Import</Button>
                  <Button variant="ghost" onClick={() => setParsedRecords([])}>Cancel Preview</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}