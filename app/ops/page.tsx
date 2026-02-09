'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../supabase-client'
import { useRouter } from 'next/navigation'
import { OpsSidebar } from '@/components/OpsSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, UploadCloud, FileSpreadsheet, Save, Calendar, CheckCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

type LocationData = {
  location_id: string;
  locations: { name: string; id: string; company_id: string }
}

export default function OpsDashboard() {
  const supabase = createClient()
  const router = useRouter()
  
  // --- STATE ---
  const [loading, setLoading] = useState(true)
  const [myLocations, setMyLocations] = useState<LocationData[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [activeView, setActiveView] = useState('reporting') // 'reporting' | 'invoices'

  // Forms - Daily Reporting
  const [reportDate, setReportDate] = useState('')
  const [salesForm, setSalesForm] = useState({ 
    transactions: '', gross: '', card: '', cash: '', comments: '',
    targetGross: '', targetTx: '',
    totalHours: '', hourlyRate: '' // Labor Fields
  })
  const [error, setError] = useState<string | null>(null)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [existingReportId, setExistingReportId] = useState<string | null>(null)

  // Forms - Invoices
  const [invoiceForm, setInvoiceForm] = useState({ supplier: '', amount: '', date: '' })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // Excel Import
  const [excelLoading, setExcelLoading] = useState(false)

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    setReportDate(new Date().toISOString().split('T')[0]) 
    setInvoiceForm(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }))

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get Role
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'employee'
      setUserRole(role)
      
      // Permissions: Regional Managers & Accountants cannot edit Ops.
      if (['regional_manager', 'accounting', 'employee'].includes(role)) setIsReadOnly(true)
      else setIsReadOnly(false)

      // Get Locations
      const { data } = await supabase.from('user_access').select(`location_id, locations ( id, name, company_id )`).eq('user_id', user.id)
      if (data) {
        // @ts-ignore
        setMyLocations(data)
        // @ts-ignore
        if (data.length === 1) setSelectedLocation(data[0])
      }
      setLoading(false)
    }
    init()
  }, [router])

  // --- 2. FETCH EXISTING REPORT ---
  useEffect(() => {
    if (!selectedLocation || !reportDate || activeView !== 'reporting') return

    const fetchReport = async () => {
      const { data } = await supabase.from('sales_daily')
        .select('*')
        .eq('location_id', selectedLocation.location_id)
        .eq('date', reportDate)
        .single()

      if (data) {
        setSalesForm({
          transactions: data.transaction_count,
          gross: data.gross_revenue,
          card: data.card_payments || 0,
          cash: data.cash_payments || 0,
          comments: data.comments || '',
          targetGross: data.target_gross_sales || '',
          targetTx: data.target_transactions || '',
          totalHours: data.total_labor_hours || '',
          hourlyRate: data.avg_hourly_rate || ''
        })
        setExistingReportId(data.id)
      } else {
        // Reset form
        setSalesForm({ 
          transactions: '', gross: '', card: '', cash: '', comments: '', 
          targetGross: '', targetTx: '', totalHours: '', hourlyRate: '' 
        })
        setExistingReportId(null)
      }
    }
    fetchReport()
  }, [selectedLocation, reportDate, activeView, supabase])

  // --- HANDLERS ---

  // 1. SAVE DAILY REPORT
  const handleReportSubmit = async () => {
    if (isReadOnly || !selectedLocation) return

    const gross = Number(salesForm.gross)
    const card = Number(salesForm.card)
    const cash = Number(salesForm.cash)
    const tx = Number(salesForm.transactions)
    const hours = Number(salesForm.totalHours)
    const rate = Number(salesForm.hourlyRate)

    // Validation
    if (tx <= 0) return setError("❌ Transactions must be greater than 0")
    if (Math.abs((card + cash) - gross) > 0.1) return setError(`❌ Validation Failed: Card (${card}) + Cash (${cash}) must equal Gross Sales (${gross})`)
    if (!gross) return setError("❌ Gross Sales is required")

    const payload = {
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      date: reportDate,
      transaction_count: tx,
      gross_revenue: gross,
      // net_revenue: calculated by backend/admin usually, but for now we rely on gross for input
      card_payments: card,
      cash_payments: cash,
      comments: salesForm.comments,
      target_gross_sales: Number(salesForm.targetGross),
      target_transactions: Number(salesForm.targetTx),
      total_labor_hours: hours,
      avg_hourly_rate: rate,
      status: 'submitted'
    }

    const query = existingReportId 
      ? supabase.from('sales_daily').update(payload).eq('id', existingReportId)
      : supabase.from('sales_daily').insert(payload)

    const { error: dbError } = await query
    if (dbError) alert('Error: ' + dbError.message)
    else { alert('✅ Daily Report Saved!'); setError(null) }
  }

  // 2. SUBMIT MANUAL INVOICE
  const handleInvoiceSubmit = async () => {
    if (!selectedLocation) return
    if (!invoiceForm.supplier || !invoiceForm.amount) return alert("Please fill details")
    
    setUploading(true)
    let imageUrl = null
    
    // Upload Photo
    if (invoiceFile) {
      const fileExt = invoiceFile.name.split('.').pop()
      const fileName = `${selectedLocation.location_id}/${Date.now()}.${fileExt}`
      
      const { error: upErr } = await supabase.storage.from('invoices').upload(fileName, invoiceFile)
      
      if (upErr) { 
        alert(upErr.message); 
        setUploading(false); 
        return 
      }
      
      const { data } = supabase.storage.from('invoices').getPublicUrl(fileName)
      imageUrl = data.publicUrl
    }

    // Save Record
    const { error } = await supabase.from('invoices').insert({
      location_id: selectedLocation.location_id,
      supplier_name: invoiceForm.supplier,
      total_amount: Number(invoiceForm.amount),
      service_date: invoiceForm.date,
      attachment_url: imageUrl,
      status: 'submitted'
    })

    if (error) alert(error.message)
    else { 
      alert('✅ Invoice Sent!'); 
      setInvoiceForm({ ...invoiceForm, supplier: '', amount: '' }); 
      setInvoiceFile(null) 
    }
    setUploading(false)
  }

  // 3. EXCEL UPLOAD
  const handleExcelUpload = async (e: any) => {
    if (!selectedLocation) return
    const file = e.target.files[0]; if (!file) return
    setExcelLoading(true)
    const reader = new FileReader()
    
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[]
        const rows: any[] = []
        
        data.forEach((row) => {
          // Polish Column Mapping
          const amount = row['PLN Netto'] || row['Netto']
          if (!amount) return
          
          let dateVal = row['Data sprzedaży']
          if (typeof dateVal === 'number') {
             const utc_days = Math.floor(dateVal - 25569); 
             const utc_value = utc_days * 86400; 
             dateVal = new Date(utc_value * 1000).toISOString().split('T')[0];
          } else if (!dateVal) {
             dateVal = new Date().toISOString().split('T')[0]
          }

          const desc = row['RK'] || row['Opis kosztu'] || 'Unknown'
          const lower = String(desc).toLowerCase()
          const type = (lower.includes('food') || lower.includes('bev') || lower.includes('meat') || lower.includes('produce') || lower.includes('towar')) ? 'COS' : 'SEMIS'

          rows.push({
            location_id: selectedLocation.location_id,
            cost_date: dateVal,
            supplier: String(row['Sprzedawca'] || 'Unknown'),
            account_description: String(desc),
            amount: Number(amount),
            cost_type: type,
            source: 'IMPORT_EXCEL'
          })
        })

        if (rows.length > 0) {
          const { error } = await supabase.from('imported_costs').insert(rows)
          if (error) throw error
          alert(`✅ Successfully imported ${rows.length} cost records!`)
        } else {
          alert("No valid data found. Check columns: Data sprzedaży, Sprzedawca, RK, PLN Netto")
        }
      } catch (err: any) { 
        alert('Import Error: ' + err.message) 
      } finally { 
        setExcelLoading(false); 
        e.target.value = null 
      }
    }
    reader.readAsBinaryString(file)
  }

  // --- RENDER ---
  if (loading) return <div className="p-8 text-center text-gray-500">Loading System...</div>

  // SCENARIO A: Location Selection
  if (!selectedLocation) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto flex flex-col justify-center">
        <h1 className="text-2xl font-bold mb-8 text-center text-slate-900">Select Location</h1>
        <div className="grid gap-4">
          {myLocations.map((item, index) => (
            <Button key={index} variant="outline" className="h-20 text-lg border-2" onClick={() => setSelectedLocation(item)}>
              📍 {item.locations.name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" className="mt-8 text-slate-500" onClick={() => { supabase.auth.signOut(); router.push('/login') }}>Log Out</Button>
      </div>
    )
  }

  // SCENARIO B: Main Dashboard
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <OpsSidebar 
        locationName={selectedLocation.locations.name} 
        activeView={activeView} 
        onNavigate={setActiveView}
        onLogout={async () => { await supabase.auth.signOut(); router.push('/login') }}
        onSwitchLocation={() => setSelectedLocation(null)}
      />

      <main className="flex-1 ml-64 p-12">
        
        {/* === VIEW 1: DAILY REPORTING === */}
        {activeView === 'reporting' && (
          <div className="max-w-4xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Daily Reporting</h1>
              <p className="text-gray-500 mt-2">Enter sales and labor data.</p>
            </header>

            <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-8 relative">
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <Label className="font-semibold text-gray-700">Date</Label>
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-gray-50 h-10 w-48" />
                </div>
                <div className={`border px-3 py-1 text-xs font-bold uppercase rounded ${isReadOnly ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}>
                  {isReadOnly ? 'LOCKED' : 'EDITABLE'}
                </div>
              </div>

              {/* SALES SECTION */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">Sales Data</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8">
                <div className="space-y-2"><Label>Gross Sales *</Label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">$</span><Input type="number" placeholder="0.00" value={salesForm.gross} onChange={(e) => setSalesForm({...salesForm, gross: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div></div>
                <div className="space-y-2"><Label>Transactions *</Label><Input type="number" placeholder="0" value={salesForm.transactions} onChange={(e) => setSalesForm({...salesForm, transactions: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg" /></div>
                
                {/* Note: Net Sales Removed as requested */}
                
                <div className="space-y-2"><Label>Card Payments</Label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">$</span><Input type="number" value={salesForm.card} onChange={(e) => setSalesForm({...salesForm, card: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div></div>
                <div className="space-y-2"><Label>Cash Payments</Label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">$</span><Input type="number" value={salesForm.cash} onChange={(e) => setSalesForm({...salesForm, cash: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div></div>
              </div>

              {/* LABOR SECTION */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">Labor & Staffing</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8 bg-blue-50 p-6 rounded border border-blue-100">
                <div className="space-y-2">
                  <Label>Total Staff Hours Worked</Label>
                  <Input type="number" placeholder="e.g. 45" value={salesForm.totalHours} onChange={(e) => setSalesForm({...salesForm, totalHours: e.target.value})} disabled={isReadOnly} className="bg-white h-12 text-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Avg Hourly Rate</Label>
                  <div className="relative"><span className="absolute left-3 top-3 text-gray-400">$</span>
                    <Input type="number" placeholder="e.g. 15.00" value={salesForm.hourlyRate} onChange={(e) => setSalesForm({...salesForm, hourlyRate: e.target.value})} disabled={isReadOnly} className="bg-white h-12 text-lg pl-8" />
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm text-blue-800 font-bold">
                  Estimated Labor Cost: ${ (Number(salesForm.totalHours) * Number(salesForm.hourlyRate)).toFixed(2) }
                </div>
              </div>

              {/* PLAN SECTION */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">Daily Plan</h3>
              <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded border border-gray-200">
                <div className="space-y-2"><Label>Planned Gross Sales</Label><Input type="number" value={salesForm.targetGross} onChange={(e) => setSalesForm({...salesForm, targetGross: e.target.value})} disabled={isReadOnly} className="bg-white" /></div>
                <div className="space-y-2"><Label>Planned Transactions</Label><Input type="number" value={salesForm.targetTx} onChange={(e) => setSalesForm({...salesForm, targetTx: e.target.value})} disabled={isReadOnly} className="bg-white" /></div>
              </div>

              <div className="mt-6"><Label>Comments</Label><Input value={salesForm.comments} onChange={(e) => setSalesForm({...salesForm, comments: e.target.value})} disabled={isReadOnly} placeholder="Notes..." className="bg-gray-50 h-12" /></div>

              {error && <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

              {!isReadOnly && <div className="mt-8 flex justify-end"><Button onClick={handleReportSubmit} className="bg-black text-white hover:bg-gray-800 h-14 px-8 text-lg font-bold rounded-sm"><Save className="w-4 h-4 mr-2"/> Save Report</Button></div>}
            </div>
          </div>
        )}

        {/* === VIEW 2: INVOICES & COSTS === */}
        {activeView === 'invoices' && (
          <div className="max-w-4xl space-y-8">
            <header>
              <h1 className="text-3xl font-bold text-gray-900">Invoices & Costs</h1>
              <p className="text-gray-500 mt-2">Upload manual bills or import bulk Excel data</p>
            </header>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Manual Upload */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="w-5 h-5"/> Manual Upload</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Supplier</Label><Input placeholder="Vendor Name" value={invoiceForm.supplier} onChange={e => setInvoiceForm({...invoiceForm, supplier: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Amount ($)</Label><Input type="number" placeholder="0.00" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={invoiceForm.date} onChange={e => setInvoiceForm({...invoiceForm, date: e.target.value})} /></div>
                  <div className="border border-dashed p-4 rounded bg-gray-50">
                    <Label className="mb-2 block">Photo / Scan</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={e => setInvoiceFile(e.target.files ? e.target.files[0] : null)} />
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleInvoiceSubmit} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Submit Invoice'}
                  </Button>
                </CardContent>
              </Card>

              {/* Excel Import */}
              <Card className="bg-green-50 border-green-200">
                <CardHeader><CardTitle className="text-green-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5"/> Excel Import</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-green-700">Import "Wide Invoice Records".<br/>Maps: <b>Data sprzedaży, Sprzedawca, RK, PLN Netto</b>.</p>
                  <div className="bg-white p-6 rounded border border-green-200 text-center">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} disabled={excelLoading} />
                  </div>
                  {excelLoading && <p className="text-center font-bold text-green-800 animate-pulse">Processing...</p>}
                  {!excelLoading && <div className="flex items-center justify-center gap-2 text-green-700 text-sm"><CheckCircle className="w-4 h-4"/> Ready for upload</div>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}