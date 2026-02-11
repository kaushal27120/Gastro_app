'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../supabase-client'
import { useRouter } from 'next/navigation'
import { OpsSidebar } from '@/components/OpsSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, UploadCloud, FileSpreadsheet, Save, CheckCircle, FileText, Receipt, Users, LogOut, MapPin } from 'lucide-react'
import * as XLSX from 'xlsx'

// --- SIDEBAR COMPONENT (INLINED FOR TRANSLATION) ---
function PolishOpsSidebar({ locationName, activeView, onNavigate, onLogout, onSwitchLocation }: any) {
  const menuItems = [
    { id: 'reporting', name: 'Raport Dzienny', icon: FileText },
    { id: 'invoices', name: 'Faktury i Koszty', icon: Receipt },
  ]

  return (
    <div className="w-64 min-h-screen bg-white border-r border-gray-200 fixed left-0 top-0 flex flex-col z-10">
      <div className="p-6 border-b border-gray-100">
        <h1 className="font-bold text-lg text-gray-900">Panel Managera</h1>
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 cursor-pointer hover:text-blue-600" onClick={onSwitchLocation}>
          <MapPin className="w-4 h-4" />
          <span className="truncate max-w-[140px]">{locationName}</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <div key={item.id} onClick={() => onNavigate(item.id)} className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${activeView === item.id ? 'bg-gray-100 text-gray-900 border border-gray-300' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <item.icon className="w-5 h-5" />
            {item.name}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div onClick={onLogout} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md cursor-pointer">
          <LogOut className="w-5 h-5" />
          Wyloguj
        </div>
      </div>
    </div>
  )
}

// --- MAIN PAGE ---
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
  const [activeView, setActiveView] = useState('reporting')

  // Forms - Reporting
  const [reportDate, setReportDate] = useState('')
  const [salesForm, setSalesForm] = useState({ 
    transactions: '', gross: '', card: '', cash: '', comments: '',
    targetGross: '', targetTx: '',
    totalHours: '', hourlyRate: '' 
  })
  const [error, setError] = useState<string | null>(null)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [existingReportId, setExistingReportId] = useState<string | null>(null)

  // Forms - Invoices
  const [invoiceForm, setInvoiceForm] = useState({ supplier: '', amount: '', date: '' })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)

  // --- INITIALIZATION ---
  useEffect(() => {
    setReportDate(new Date().toISOString().split('T')[0]) 
    setInvoiceForm(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }))

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
      const role = profile?.role || 'employee'
      setUserRole(role)
      
      if (['regional_manager', 'accounting', 'employee'].includes(role)) setIsReadOnly(true)
      else setIsReadOnly(false)

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

  // --- FETCH DATA ---
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
        setSalesForm({ transactions: '', gross: '', card: '', cash: '', comments: '', targetGross: '', targetTx: '', totalHours: '', hourlyRate: '' })
        setExistingReportId(null)
      }
    }
    fetchReport()
  }, [selectedLocation, reportDate, activeView, supabase])

  // --- HANDLERS ---
  const handleReportSubmit = async () => {
    if (isReadOnly || !selectedLocation) return

    const gross = Number(salesForm.gross)
    const card = Number(salesForm.card)
    const cash = Number(salesForm.cash)
    const tx = Number(salesForm.transactions)
    const hours = Number(salesForm.totalHours)
    const rate = Number(salesForm.hourlyRate)

    if (tx <= 0) return setError("❌ Liczba transakcji musi być większa od 0")
    if (Math.abs((card + cash) - gross) > 0.1) return setError(`❌ Błąd walidacji: Karta (${card}) + Gotówka (${cash}) muszą równać się Sprzedaży Brutto (${gross})`)
    if (!gross) return setError("❌ Sprzedaż Brutto jest wymagana")

    const payload = {
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      date: reportDate,
      transaction_count: tx,
      gross_revenue: gross,
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
    if (dbError) alert('Błąd: ' + dbError.message)
    else { alert('✅ Raport Dzienny Zapisany!'); setError(null) }
  }

  const handleInvoiceSubmit = async () => {
    if (!selectedLocation) return
    if (!invoiceForm.supplier || !invoiceForm.amount) return alert("Wypełnij dane dostawcy i kwotę")
    setUploading(true)
    let imageUrl = null
    if (invoiceFile) {
      const fileName = `${selectedLocation.location_id}/${Date.now()}.${invoiceFile.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('invoices').upload(fileName, invoiceFile)
      if (upErr) { alert(upErr.message); setUploading(false); return }
      const { data } = supabase.storage.from('invoices').getPublicUrl(fileName)
      imageUrl = data.publicUrl
    }
    const { error } = await supabase.from('invoices').insert({
      location_id: selectedLocation.location_id,
      supplier_name: invoiceForm.supplier,
      total_amount: Number(invoiceForm.amount),
      service_date: invoiceForm.date,
      attachment_url: imageUrl,
      status: 'submitted'
    })
    if (error) alert(error.message)
    else { alert('✅ Faktura Wysłana!'); setInvoiceForm({ ...invoiceForm, supplier: '', amount: '' }); setInvoiceFile(null) }
    setUploading(false)
  }

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
          const amount = row['PLN Netto'] || row['Netto']
          if (!amount) return
          let dateVal = row['Data sprzedaży']
          if (typeof dateVal === 'number') {
             const utc_days = Math.floor(dateVal - 25569); const utc_value = utc_days * 86400; 
             dateVal = new Date(utc_value * 1000).toISOString().split('T')[0];
          } else if (!dateVal) dateVal = new Date().toISOString().split('T')[0]

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
          await supabase.from('imported_costs').insert(rows)
          alert(`✅ Zaimportowano ${rows.length} rekordów kosztowych!`)
        } else alert("Nie znaleziono poprawnych danych. Sprawdź kolumny.")
      } catch (err: any) { alert('Błąd Importu: ' + err.message) }
      finally { setExcelLoading(false); e.target.value = null }
    }
    reader.readAsBinaryString(file)
  }

  // Calculated Field
  const plannedAvgCheck = (Number(salesForm.targetGross) > 0 && Number(salesForm.targetTx) > 0) 
    ? (Number(salesForm.targetGross) / Number(salesForm.targetTx)).toFixed(2) : '0.00'

  if (loading) return <div className="p-8 text-center text-gray-500">Ładowanie systemu...</div>

  if (!selectedLocation) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto flex flex-col justify-center">
        <h1 className="text-2xl font-bold mb-8 text-center text-slate-900">Wybierz Lokalizację</h1>
        <div className="grid gap-4">
          {myLocations.map((item, index) => (
            <Button key={index} variant="outline" className="h-20 text-lg border-2 hover:border-black" onClick={() => setSelectedLocation(item)}>
              📍 {item.locations.name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" className="mt-8 text-slate-500" onClick={() => { supabase.auth.signOut(); router.push('/login') }}>Wyloguj</Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <PolishOpsSidebar 
        locationName={selectedLocation.locations.name} 
        activeView={activeView} 
        onNavigate={setActiveView}
        onLogout={async () => { await supabase.auth.signOut(); router.push('/login') }}
        onSwitchLocation={() => setSelectedLocation(null)}
      />

      <main className="flex-1 ml-64 p-12">
        
        {/* === VIEW 1: RAPORT DZIENNY === */}
        {activeView === 'reporting' && (
          <div className="max-w-4xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Raport Dzienny</h1>
              <p className="text-gray-500 mt-2">Wprowadzanie wyników sprzedaży i danych operacyjnych.</p>
            </header>

            <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-8 relative">
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <Label className="font-semibold text-gray-700">Data Raportu</Label>
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-gray-50 h-10 w-48" />
                </div>
              </div>

              {/* SALES */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">Sprzedaż Rzeczywista</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8">
                <div className="space-y-2"><Label>Utarg Brutto *</Label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span><Input type="number" placeholder="0.00" value={salesForm.gross} onChange={(e) => setSalesForm({...salesForm, gross: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div></div>
                <div className="space-y-2"><Label>Liczba Transakcji *</Label><Input type="number" placeholder="0" value={salesForm.transactions} onChange={(e) => setSalesForm({...salesForm, transactions: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg" /></div>
                <div className="space-y-2"><Label>Karty (Terminal)</Label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span><Input type="number" value={salesForm.card} onChange={(e) => setSalesForm({...salesForm, card: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div></div>
                <div className="space-y-2"><Label>Gotówka</Label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span><Input type="number" value={salesForm.cash} onChange={(e) => setSalesForm({...salesForm, cash: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div></div>
              </div>

              {/* LABOR */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">Koszty Pracy (Staffing)</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8 bg-blue-50 p-6 rounded border border-blue-100">
                <div className="space-y-2">
                  <Label>Liczba Godzin Pracy (Suma)</Label>
                  <Input type="number" placeholder="np. 45" value={salesForm.totalHours} onChange={(e) => setSalesForm({...salesForm, totalHours: e.target.value})} disabled={isReadOnly} className="bg-white h-12 text-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Średnia Stawka Godzinowa</Label>
                  <div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input type="number" placeholder="np. 25.00" value={salesForm.hourlyRate} onChange={(e) => setSalesForm({...salesForm, hourlyRate: e.target.value})} disabled={isReadOnly} className="bg-white h-12 text-lg pl-8" />
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm text-blue-800 font-bold">
                  Szacowany Koszt Pracy: {(Number(salesForm.totalHours) * Number(salesForm.hourlyRate)).toFixed(2)} zł
                </div>
              </div>

              {/* PLAN */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">Plan Dzienny</h3>
              <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded border border-gray-200">
                <div className="space-y-2"><Label>Planowany Utarg</Label><Input type="number" value={salesForm.targetGross} onChange={(e) => setSalesForm({...salesForm, targetGross: e.target.value})} disabled={isReadOnly} className="bg-white" /></div>
                <div className="space-y-2"><Label>Planowana Liczba Transakcji</Label><Input type="number" value={salesForm.targetTx} onChange={(e) => setSalesForm({...salesForm, targetTx: e.target.value})} disabled={isReadOnly} className="bg-white" /></div>
              </div>

              <div className="mt-6"><Label>Komentarz</Label><Input value={salesForm.comments} onChange={(e) => setSalesForm({...salesForm, comments: e.target.value})} disabled={isReadOnly} placeholder="Uwagi operacyjne..." className="bg-gray-50 h-12" /></div>

              {error && <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>}

              {!isReadOnly && <div className="mt-8 flex justify-end"><Button onClick={handleReportSubmit} className="bg-black text-white hover:bg-gray-800 h-14 px-8 text-lg font-bold rounded-sm"><Save className="w-4 h-4 mr-2"/> Zapisz Raport</Button></div>}
            </div>
          </div>
        )}

        {/* === VIEW 2: FAKTURY I KOSZTY === */}
        {activeView === 'invoices' && (
          <div className="max-w-4xl space-y-8">
            <header>
              <h1 className="text-3xl font-bold text-gray-900">Faktury i Koszty</h1>
              <p className="text-gray-500 mt-2">Prześlij faktury ręcznie lub importuj zestawienie Excel.</p>
            </header>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Manual Upload */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="w-5 h-5"/> Przesyłanie Ręczne</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Dostawca / Opis</Label><Input placeholder="Nazwa Dostawcy" value={invoiceForm.supplier} onChange={e => setInvoiceForm({...invoiceForm, supplier: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Kwota (zł)</Label><Input type="number" placeholder="0.00" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Data Faktury</Label><Input type="date" value={invoiceForm.date} onChange={e => setInvoiceForm({...invoiceForm, date: e.target.value})} /></div>
                  <div className="border border-dashed p-4 rounded bg-gray-50">
                    <Label className="mb-2 block">Zdjęcie / Skan</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={e => setInvoiceFile(e.target.files ? e.target.files[0] : null)} />
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleInvoiceSubmit} disabled={uploading}>
                    {uploading ? 'Wysyłanie...' : 'Wyślij Fakturę'}
                  </Button>
                </CardContent>
              </Card>

              {/* Excel Import */}
              <Card className="bg-green-50 border-green-200">
                <CardHeader><CardTitle className="text-green-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5"/> Import Excel (Masowy)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-green-700">Zaimportuj "Szerokie Zestawienie".<br/>Wymagane kolumny: <b>Data sprzedaży, Sprzedawca, RK, PLN Netto</b>.</p>
                  <div className="bg-white p-6 rounded border border-green-200 text-center">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} disabled={excelLoading} />
                  </div>
                  {excelLoading && <p className="text-center font-bold text-green-800 animate-pulse">Przetwarzanie...</p>}
                  {!excelLoading && <div className="flex items-center justify-center gap-2 text-green-700 text-sm"><CheckCircle className="w-4 h-4"/> Gotowy do importu</div>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}