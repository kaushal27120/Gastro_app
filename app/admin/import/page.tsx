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
  
  useEffect(() => {
    ;(async () => {
      try {
        const res = await supabase.from('locations').select('id,name')
        const data = res.data as LocationRow[] | null
        setLocations(data || [])
        if (data && data.length === 1) setSelectedLocation(data[0].id)
      } catch (err) {
        console.warn('Could not fetch locations', err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
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
      
      // Convert to JSON (Array of arrays to handle columns by index/letter easier)
      const data = XLSX.utils.sheet_to_json(ws, { header: "A" }) as Array<Record<string, unknown>>

      // Convert rows into preview records (no DB writes yet)
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

      // attempt automatic matching for preview
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
      setLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  const confirmImport = async () => {
    if (!parsedRecords.length) return alert('No records to import')
    if (!selectedLocation) return alert('Select a location')
    setProcessingPreview(true)
    try {
      const resolvedInventory: Array<Record<string, unknown>> = []
      const resolvedPrices: Array<Record<string, unknown>> = []
      // resolve ingredient ids from matched or overrides
      for (const r of parsedRecords) {
        const prod = (r.override_ingredient_id || r.matched_ingredient?.id) || null
        if (prod) {
          resolvedInventory.push({ ingredient_id: prod, location_id: selectedLocation, tx_type: 'invoice_in', quantity: r.quantity || 1, unit: r.unit || 'pcs', price: r.amount, reference: 'IMPORT_EXCEL', created_at: r.sale_date })
          resolvedPrices.push({ ingredient_id: prod, price: r.amount, unit: r.unit || '', supplier: r.supplier || null, invoice_ref: null, recorded_at: r.sale_date })
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
      setParsedRecords([])
    } catch (err) {
      console.error(err)
      alert('Import failed: ' + String(err))
    }
    setProcessingPreview(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Excel Cost Import</h1>
      <Card>
        <CardHeader><CardTitle>Upload Wide Invoice Records</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Mapping: Col E (Date) | Col G (Supplier) | Col RK (Account) | Col S (Amount)</p>
            <div className="flex gap-2 items-center">
              <label className="text-sm">Location:</label>
              <select value={selectedLocation || ''} onChange={e => setSelectedLocation(e.target.value)}>
                <option value="">Select location</option>
                {locations.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
              <label className="text-sm">Product Col:</label>
              <Input value={productCol} onChange={e => setProductCol(e.target.value.toUpperCase())} />
              <label className="text-sm">Qty Col:</label>
              <Input value={quantityCol} onChange={e => setQuantityCol(e.target.value.toUpperCase())} />
              <label className="text-sm">Price Col:</label>
              <Input value={priceCol} onChange={e => setPriceCol(e.target.value.toUpperCase())} />
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