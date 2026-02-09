'use client'
import { useState } from 'react'
import { createClient } from '@/app/supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as XLSX from 'xlsx' // Requires: npm install xlsx

export default function ImportPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
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

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    const reader = new FileReader()
    
    reader.onload = async (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      
      // Convert to JSON (Array of arrays to handle columns by index/letter easier)
      const data = XLSX.utils.sheet_to_json(ws, { header: "A" }) as any[]

      // Filter and Map based on Specs
      const recordsToInsert: any[] = []

      data.forEach((row) => {
        // Skip header rows or empty rows
        if (!row['E'] || !row['S']) return 

        const saleDateRaw = row['E'] // Column E (Date)
        const supplier = row['G'] || 'Unknown' // Column G
        const rk = row['RK'] || row['H'] || '' // Column RK (Sometimes H depending on sheet, usually RK is logic key)
        const amount = row['S'] // Column S (Amount)

        // Try to parse date
        let finalDate = saleDateRaw
        if (typeof saleDateRaw === 'number') {
           finalDate = excelDateToJSDate(saleDateRaw)
        }

        const costType = classifyCost(String(rk))

        // IMPORTANT: We need a location_id. 
        // For MVP, we assign to the first location found or need a dropdown.
        // Assuming we upload for a specific store context or mapping exists in Excel.
        // For now, I'll assume we pass a location_id via a dropdown or prop.
        // Since this is a page, let's hardcode a selector or fetch one.
        
        if (amount) {
           recordsToInsert.push({
             cost_date: finalDate,
             supplier: String(supplier),
             account_description: String(rk),
             amount: Number(amount),
             cost_type: costType,
             source: 'IMPORT_EXCEL'
             // location_id: need to add selector
           })
        }
      })

      if (recordsToInsert.length > 0) {
        // Insert to Supabase
        // Note: You need to select a location first in UI, logic skipped for brevity
        alert(`Ready to import ${recordsToInsert.length} rows. (Please add Location Selector logic)`)
        // await supabase.from('imported_costs').insert(recordsToInsert)
      }
      setLoading(false)
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Excel Cost Import</h1>
      <Card>
        <CardHeader><CardTitle>Upload "Wide Invoice Records"</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Mapping: Col E (Date) | Col G (Supplier) | Col RK (Account) | Col S (Amount)</p>
            <Input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={loading} />
            {loading && <p>Processing...</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}