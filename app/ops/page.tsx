'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../supabase-client'
import { useRouter } from 'next/navigation'
import { OpsSidebar } from '@/components/OpsSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, UploadCloud, FileSpreadsheet, Save, CheckCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

type LocationData = {
  location_id: string
  locations: { name: string; id: string; company_id: string }
}

const VAT_RATE = 0.08 // 8% VAT – change to 0.23 if you want

export default function OpsDashboard() {
  const supabase = createClient()
  const router = useRouter()

  // --- STAN ---
  const [loading, setLoading] = useState(true)
  const [myLocations, setMyLocations] = useState<LocationData[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [activeView, setActiveView] = useState<'reporting' | 'invoices'>('reporting')

  const [reportDate, setReportDate] = useState('')
  const [salesForm, setSalesForm] = useState({
    transactions: '',
    gross: '',
    card: '',
    cash: '',
    comments: '',
    targetGross: '',
    targetTx: '',
    totalHours: '',
    hourlyRate: '',
    // new fields
    cashReported: '',
    cashPhysical: '',
    pettyExpense: '',
    losses: '',
    refunds: '',
    incidentType: '',
    incidentDetails: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [existingReportId, setExistingReportId] = useState<string | null>(null)

  const [invoiceForm, setInvoiceForm] = useState({ supplier: '', amount: '', date: '' })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)

  // --- INICJALIZACJA ---
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setReportDate(today)
    setInvoiceForm(prev => ({ ...prev, date: today }))

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'employee'
      setUserRole(role)

      if (['regional_manager', 'accounting', 'employee'].includes(role)) {
        setIsReadOnly(true)
      } else {
        setIsReadOnly(false)
      }

      const { data: access } = await supabase
        .from('user_access')
        .select('location_id, locations ( id, name, company_id )')
        .eq('user_id', user.id)

      if (access) {
        // @ts-ignore
        setMyLocations(access)
        // @ts-ignore
        if (access.length === 1) setSelectedLocation(access[0])
      }

      setLoading(false)
    }

    init()
  }, [router, supabase])

  // --- POBIERANIE RAPORTU Z DB ---
  useEffect(() => {
    if (!selectedLocation || !reportDate || activeView !== 'reporting') return

    const fetchReport = async () => {
      const { data } = await supabase
        .from('sales_daily')
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
          hourlyRate: data.avg_hourly_rate || '',
          cashReported: data.cash_reported || '',
          cashPhysical: data.cash_physical || '',
          pettyExpense: data.petty_expenses || '',
          losses: data.daily_losses || '',
          refunds: data.daily_refunds || '',
          incidentType: data.incident_type || '',
          incidentDetails: data.incident_details || '',
        })
        setExistingReportId(data.id)
      } else {
        setSalesForm({
          transactions: '',
          gross: '',
          card: '',
          cash: '',
          comments: '',
          targetGross: '',
          targetTx: '',
          totalHours: '',
          hourlyRate: '',
          cashReported: '',
          cashPhysical: '',
          pettyExpense: '',
          losses: '',
          refunds: '',
          incidentType: '',
          incidentDetails: '',
        })
        setExistingReportId(null)
      }
    }

    fetchReport()
  }, [selectedLocation, reportDate, activeView, supabase])

  // --- OBLICZENIA KPI ---
  const gross = Number(salesForm.gross) || 0
  const tx = Number(salesForm.transactions) || 0
  const card = Number(salesForm.card) || 0
  const cash = Number(salesForm.cash) || 0
  const hours = Number(salesForm.totalHours) || 0
  const rate = Number(salesForm.hourlyRate) || 0
  const planGross = Number(salesForm.targetGross) || 0
  const planTx = Number(salesForm.targetTx) || 0

  const cashReported = Number(salesForm.cashReported) || 0
  const cashPhysical = Number(salesForm.cashPhysical) || 0
  const pettyExpense = Number(salesForm.pettyExpense) || 0
  const losses = Number(salesForm.losses) || 0
  const refunds = Number(salesForm.refunds) || 0
  const cashDiff = cashPhysical - cashReported
  const dailyOpsTotal = pettyExpense + losses + refunds

  const net = gross > 0 ? gross / (1 + VAT_RATE) : 0
  const vat = gross - net

  const planNet = planGross > 0 ? planGross / (1 + VAT_RATE) : 0
  const planRealisation = planNet > 0 ? net / planNet : 0
  const planDeviation = net - planNet

  const aov = tx > 0 ? net / tx : 0
  const cardPercent = gross > 0 ? card / gross : 0
  const cashPercent = gross > 0 ? cash / gross : 0

  const laborCost = hours * rate
  const laborPercent = net > 0 ? laborCost / net : 0
  const salesPerHour = hours > 0 ? net / hours : 0
  const laborPerTx = tx > 0 ? laborCost / tx : 0

  const planTxRealisation = planTx > 0 ? tx / planTx : 0

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(v || 0)

  const formatMoney2 = (v: number) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 2,
    }).format(v || 0)

  const formatPercent = (v: number) =>
    (v * 100).toFixed(1).replace('.', ',') + '%'

  // --- ZAPIS RAPORTU ---
  const handleReportSubmit = async () => {
    if (isReadOnly || !selectedLocation) return

    if (tx <= 0) {
      setError('❌ Liczba transakcji musi być większa od 0')
      return
    }

    if (Math.abs(card + cash - gross) > 0.1) {
      setError(
        `❌ Walidacja nieudana: Karty (${card}) + Gotówka (${cash}) musi równać się Utargowi brutto (${gross})`,
      )
      return
    }

    if (!gross) {
      setError('❌ Utarg brutto jest wymagany')
      return
    }

    const payload: any = {
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      date: reportDate,
      transaction_count: tx,
      gross_revenue: gross,
      card_payments: card,
      cash_payments: cash,
      comments: salesForm.comments,
      target_gross_sales: planGross,
      target_transactions: planTx,
      total_labor_hours: hours,
      avg_hourly_rate: rate,
      status: 'submitted',
      cash_reported: cashReported,
      cash_physical: cashPhysical,
      cash_diff: cashDiff,
      petty_expenses: pettyExpense,
      daily_losses: losses,
      daily_refunds: refunds,
      incident_type: salesForm.incidentType,
      incident_details: salesForm.incidentDetails,
    }

    const query = existingReportId
      ? supabase.from('sales_daily').update(payload).eq('id', existingReportId)
      : supabase.from('sales_daily').insert(payload)

    const { error } = await query
    if (error) {
      alert('Błąd zapisu: ' + error.message)
    } else {
      alert('✅ Raport dzienny zapisany')
      setError(null)
    }
  }

  // --- ZAPIS FAKTURY RĘCZNEJ ---
  const handleInvoiceSubmit = async () => {
    if (!selectedLocation) return
    if (!invoiceForm.supplier || !invoiceForm.amount) {
      alert('Proszę uzupełnić dostawcę i kwotę')
      return
    }

    setUploading(true)
    let imageUrl: string | null = null

    if (invoiceFile) {
      const ext = invoiceFile.name.split('.').pop()
      const fileName = `${selectedLocation.location_id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('invoices')
        .upload(fileName, invoiceFile)

      if (upErr) {
        alert('Błąd wysyłania pliku: ' + upErr.message)
        setUploading(false)
        return
      }

      const { data } = supabase.storage.from('invoices').getPublicUrl(fileName)
      imageUrl = data.publicUrl
    }

    const { error } = await supabase.from('invoices').insert({
      location_id: selectedLocation.location_id,
      supplier_name: invoiceForm.supplier,
      total_amount: Number(invoiceForm.amount),
      service_date: invoiceForm.date,
      attachment_url: imageUrl,
      status: 'submitted',
    })

    if (error) {
      alert('Błąd zapisu faktury: ' + error.message)
    } else {
      alert('✅ Faktura wysłana do zatwierdzenia')
      setInvoiceForm({ ...invoiceForm, supplier: '', amount: '' })
      setInvoiceFile(null)
    }

    setUploading(false)
  }

  // --- IMPORT EXCEL ---
  const handleExcelUpload = async (e: any) => {
    if (!selectedLocation) return
    const file = e.target.files[0]
    if (!file) return

    setExcelLoading(true)
    const reader = new FileReader()

    reader.onload = async evt => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet) as any[]

        const rows: any[] = []

        data.forEach(row => {
          const amount = row['PLN Netto'] || row['Netto']
          if (!amount) return

          let dateVal = row['Data sprzedaży']
          if (typeof dateVal === 'number') {
            const utc_days = Math.floor(dateVal - 25569)
            const utc_value = utc_days * 86400
            dateVal = new Date(utc_value * 1000).toISOString().split('T')[0]
          } else if (!dateVal) {
            dateVal = new Date().toISOString().split('T')[0]
          }

          const desc = row['RK'] || row['Opis kosztu'] || 'Brak opisu'
          const lower = String(desc).toLowerCase()
          const type =
            lower.includes('food') ||
            lower.includes('bev') ||
            lower.includes('meat') ||
            lower.includes('produce') ||
            lower.includes('towar')
              ? 'COS'
              : 'SEMIS'

          rows.push({
            location_id: selectedLocation.location_id,
            cost_date: dateVal,
            supplier: String(row['Sprzedawca'] || 'Nieznany'),
            account_description: String(desc),
            amount: Number(amount),
            cost_type: type,
            source: 'IMPORT_EXCEL',
          })
        })

        if (rows.length === 0) {
          alert(
            'Nie znaleziono poprawnych danych w pliku (sprawdź: Data sprzedaży, Sprzedawca, RK, PLN Netto)',
          )
        } else {
          const { error } = await supabase.from('imported_costs').insert(rows)
          if (error) throw error
          alert(`✅ Zaimportowano ${rows.length} pozycji kosztowych`)
        }
      } catch (err: any) {
        alert('Błąd importu: ' + err.message)
      } finally {
        setExcelLoading(false)
        e.target.value = null
      }
    }

    reader.readAsBinaryString(file)
  }

  // --- RENDER ---

  if (loading) return <div className="p-8 text-center text-gray-500">Ładowanie…</div>

  if (!selectedLocation) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto flex flex-col justify-center">
        <h1 className="text-2xl font-bold mb-8 text-center text-slate-900">
          Wybierz lokalizację
        </h1>
        <div className="grid gap-4">
          {myLocations.map((item, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-20 text-lg border-2"
              onClick={() => setSelectedLocation(item)}
            >
              📍 {item.locations.name}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="mt-8 text-slate-500"
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/login')
          }}
        >
          Wyloguj
        </Button>
      </div>
    )
  }

  const kpiColorLabor =
    laborPercent < 0.27
      ? 'text-green-700'
      : laborPercent <= 0.3
      ? 'text-yellow-700'
      : 'text-red-700'

  const cashDiffColor =
    cashDiff === 0 ? 'text-green-700' : 'text-red-700'

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <OpsSidebar
        locationName={selectedLocation.locations.name}
        activeView={activeView}
        onNavigate={(view: string) => setActiveView(view as 'reporting' | 'invoices')}
        onLogout={async () => {
          await supabase.auth.signOut()
          router.push('/login')
        }}
        onSwitchLocation={() => setSelectedLocation(null)}
      />

      <main className="flex-1 ml-64 p-12">
        {/* === RAPORT DZIENNY === */}
        {activeView === 'reporting' && (
          <div className="max-w-4xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Raport dzienny</h1>
              <p className="text-gray-500 mt-2">
                Sprzedaż → Plan vs wykonanie → Koszt pracy → KPI dnia → Gotówka → Koszty
                operacyjne → Zdarzenia.
              </p>
            </header>

            <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-8">
              {/* Data */}
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <Label className="font-semibold text-gray-700">Data raportu</Label>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                    className="bg-gray-50 h-10 w-48"
                  />
                </div>
              </div>

              {/* 1) SPRZEDAŻ */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                Sprzedaż rzeczywista
              </h3>

              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-6">
                <div className="space-y-2">
                  <Label>Utarg brutto *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={salesForm.gross}
                      onChange={e =>
                        setSalesForm({ ...salesForm, gross: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50 h-12 text-lg pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Liczba transakcji *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={salesForm.transactions}
                    onChange={e =>
                      setSalesForm({ ...salesForm, transactions: e.target.value })
                    }
                    disabled={isReadOnly}
                    className="bg-gray-50 h-12 text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Karty (terminal)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={salesForm.card}
                      onChange={e =>
                        setSalesForm({ ...salesForm, card: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50 h-12 text-lg pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Gotówka</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={salesForm.cash}
                      onChange={e =>
                        setSalesForm({ ...salesForm, cash: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50 h-12 text-lg pl-8"
                    />
                  </div>
                </div>
              </div>

              {/* Podsumowanie sprzedaży */}
              <Card className="mb-8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Podsumowanie sprzedaży
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Utarg netto</p>
                    <p className="text-xl font-bold text-slate-900">
                      {formatMoney(net)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Utarg brutto:{' '}
                      <span className="font-medium">{formatMoney(gross)}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      VAT:{' '}
                      <span className="font-medium">{formatMoney(vat)}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Średni paragon (AOV)
                    </p>
                    <p className="text-xl font-bold text-slate-900">
                      {formatMoney2(aov)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Transakcji:{' '}
                      <span className="font-medium">{tx}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Struktura płatności
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Karty:{' '}
                      <span className="font-medium">
                        {gross > 0 ? formatPercent(cardPercent) : '0,0%'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Gotówka:{' '}
                      <span className="font-medium">
                        {gross > 0 ? formatPercent(cashPercent) : '0,0%'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 2) PLAN VS WYKONANIE */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                Plan vs wykonanie
              </h3>

              <div className="grid grid-cols-2 gap-6 mb-4 bg-gray-50 p-6 rounded border border-gray-200">
                <div className="space-y-2">
                  <Label>Planowany utarg brutto</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={salesForm.targetGross}
                    onChange={e =>
                      setSalesForm({ ...salesForm, targetGross: e.target.value })
                    }
                    disabled={isReadOnly}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Planowana liczba transakcji</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={salesForm.targetTx}
                    onChange={e =>
                      setSalesForm({ ...salesForm, targetTx: e.target.value })
                    }
                    disabled={isReadOnly}
                    className="bg-white"
                  />
                </div>
              </div>

              <Card className="mb-8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Podsumowanie planu
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Sprzedaż netto vs plan
                    </p>
                    <p className="text-xl font-bold text-slate-900">
                      {formatMoney(net)}{' '}
                      <span className="text-xs text-slate-500 font-normal">
                        / plan {formatMoney(planNet)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Realizacja planu:{' '}
                      <span className="font-bold">
                        {planNet > 0 ? formatPercent(planRealisation) : '0,0%'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Odchylenie kwotowe:{' '}
                      <span className="font-medium">
                        {formatMoney(planDeviation)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Transakcje vs plan
                    </p>
                    <p className="text-xl font-bold text-slate-900">
                      {tx}{' '}
                      <span className="text-xs text-slate-500 font-normal">
                        / plan {planTx}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Realizacja planu transakcji:{' '}
                      <span className="font-bold">
                        {planTx > 0
                          ? formatPercent(planTxRealisation)
                          : '0,0%'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 3) KOSZT PRACY */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                Koszt pracy
              </h3>

              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-4 bg-blue-50 p-6 rounded border border-blue-100">
                <div className="space-y-2">
                  <Label>Łączna liczba godzin</Label>
                  <Input
                    type="number"
                    placeholder="np. 45"
                    value={salesForm.totalHours}
                    onChange={e =>
                      setSalesForm({ ...salesForm, totalHours: e.target.value })
                    }
                    disabled={isReadOnly}
                    className="bg-white h-12 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Średni koszt godziny (pracodawcy)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input
                      type="number"
                      placeholder="np. 25,00"
                      value={salesForm.hourlyRate}
                      onChange={e =>
                        setSalesForm({ ...salesForm, hourlyRate: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-white h-12 text-lg pl-8"
                    />
                  </div>
                </div>
              </div>

              <Card className="mb-8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Podsumowanie kosztu pracy
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Koszt pracy (PLN)
                    </p>
                    <p className={`text-xl font-bold ${kpiColorLabor}`}>
                      {formatMoney(laborCost)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Koszt pracy % sprzedaży netto:{' '}
                      <span className="font-bold">
                        {net > 0 ? formatPercent(laborPercent) : '0,0%'}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Produktywność
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Sprzedaż / roboczogodzina:{' '}
                      <span className="font-bold">
                        {formatMoney2(salesPerHour)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Koszt pracy / transakcję:{' '}
                      <span className="font-bold">
                        {tx > 0 ? formatMoney2(laborPerTx) : '0,00 zł'}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 4) KPI DNIA */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                KPI dnia – podsumowanie
              </h3>

              <Card className="mb-8">
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm pt-6">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Sprzedaż netto
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatMoney(net)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Realizacja planu %
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {planNet > 0 ? formatPercent(planRealisation) : '0,0%'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Średni paragon
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatMoney2(aov)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Koszt pracy %
                    </p>
                    <p className={`text-lg font-bold ${kpiColorLabor}`}>
                      {net > 0 ? formatPercent(laborPercent) : '0,0%'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Sprzedaż / roboczogodzina
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatMoney2(salesPerHour)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">
                      Liczba transakcji
                    </p>
                    <p className="text-lg font-bold text-slate-900">{tx}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 5) KONTROLA GOTÓWKI */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                Kontrola gotówki
              </h3>

              <Card className="mb-8">
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-sm">
                  <div className="space-y-2">
                    <Label>Stan gotówki wg raportu</Label>
                    <Input
                      type="number"
                      placeholder="np. 1000"
                      value={salesForm.cashReported}
                      onChange={e =>
                        setSalesForm({ ...salesForm, cashReported: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stan gotówki fizyczny</Label>
                    <Input
                      type="number"
                      placeholder="np. 1000"
                      value={salesForm.cashPhysical}
                      onChange={e =>
                        setSalesForm({ ...salesForm, cashPhysical: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Różnica</Label>
                    <p className={`h-10 flex items-center font-bold ${cashDiffColor}`}>
                      {formatMoney2(cashDiff)}{' '}
                      {cashDiff === 0
                        ? '(OK)'
                        : cashDiff > 0
                        ? '– nadwyżka'
                        : '– niedobór'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 6) KOSZTY OPERACYJNE DNIA */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                Koszty operacyjne dnia
              </h3>

              <Card className="mb-8">
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 text-sm">
                  <div className="space-y-2">
                    <Label>Wydatki drobne</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={salesForm.pettyExpense}
                      onChange={e =>
                        setSalesForm({ ...salesForm, pettyExpense: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Straty</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={salesForm.losses}
                      onChange={e =>
                        setSalesForm({ ...salesForm, losses: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zwroty / reklamacje</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={salesForm.refunds}
                      onChange={e =>
                        setSalesForm({ ...salesForm, refunds: e.target.value })
                      }
                      disabled={isReadOnly}
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Suma kosztów dnia</Label>
                    <p className="h-10 flex items-center font-bold text-slate-900">
                      {formatMoney2(dailyOpsTotal)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 7) ZDARZENIA DNIA */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">
                Zdarzenia dnia
              </h3>

              <Card className="mb-8">
                <CardContent className="space-y-4 pt-4 text-sm">
                  <div className="space-y-2">
                    <Label>Typ zdarzenia</Label>
                    <select
                      value={salesForm.incidentType}
                      onChange={e =>
                        setSalesForm({
                          ...salesForm,
                          incidentType: e.target.value,
                        })
                      }
                      disabled={isReadOnly}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">– wybierz –</option>
                      <option value="problem_operacyjny">Problem operacyjny</option>
                      <option value="awaria">Awaria</option>
                      <option value="braki_kadrowe">Braki kadrowe</option>
                      <option value="reklamacje">Reklamacje</option>
                      <option value="inne">Inne</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Opis zdarzenia</Label>
                    <textarea
                      value={salesForm.incidentDetails}
                      onChange={e =>
                        setSalesForm({
                          ...salesForm,
                          incidentDetails: e.target.value,
                        })
                      }
                      disabled={isReadOnly}
                      placeholder="Opisz krótko najważniejsze zdarzenia dnia (awarie, reklamacje, problemy z dostawą itp.)"
                      className="w-full min-h-[80px] rounded-md border border-input bg-gray-50 px-3 py-2 text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Błąd / Zapis */}
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              {!isReadOnly && (
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleReportSubmit}
                    className="bg-black text-white hover:bg-gray-800 h-14 px-8 text-lg font-bold rounded-sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Zapisz raport dnia
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === FAKTURY I KOSZTY === */}
        {activeView === 'invoices' && (
          <div className="max-w-4xl space-y-8">
            <header>
              <h1 className="text-3xl font-bold text-gray-900">Faktury i koszty</h1>
              <p className="text-gray-500 mt-2">
                Wprowadź pojedyncze wydatki lub zaimportuj koszty z Excela.
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UploadCloud className="w-5 h-5" />
                    Ręczne dodanie faktury
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dostawca</Label>
                    <Input
                      placeholder="np. Dostawca pieczywa"
                      value={invoiceForm.supplier}
                      onChange={e =>
                        setInvoiceForm({ ...invoiceForm, supplier: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kwota (zł)</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={invoiceForm.amount}
                      onChange={e =>
                        setInvoiceForm({ ...invoiceForm, amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data (okres sprzedaży)</Label>
                    <Input
                      type="date"
                      value={invoiceForm.date}
                      onChange={e =>
                        setInvoiceForm({ ...invoiceForm, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="border border-dashed p-4 rounded bg-gray-50">
                    <Label className="mb-2 block">Zdjęcie / skan (opcjonalnie)</Label>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e =>
                        setInvoiceFile(e.target.files ? e.target.files[0] : null)
                      }
                    />
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleInvoiceSubmit}
                    disabled={uploading}
                  >
                    {uploading ? 'Wysyłanie…' : 'Zapisz fakturę'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Import kosztów z Excela
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-green-700">
                    Oczekiwane kolumny: <b>Data sprzedaży</b>, <b>Sprzedawca</b>,{' '}
                    <b>RK</b>, <b>PLN Netto</b>.
                  </p>
                  <div className="bg-white p-6 rounded border border-green-200 text-center">
                    <Input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleExcelUpload}
                      disabled={excelLoading}
                    />
                  </div>
                  {excelLoading ? (
                    <p className="text-center font-bold text-green-800 animate-pulse">
                      Przetwarzanie pliku…
                    </p>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-green-700 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Gotowe do importu
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}