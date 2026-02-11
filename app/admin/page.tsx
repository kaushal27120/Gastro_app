'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../supabase-client'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Filter, MapPin } from 'lucide-react'

// --- SIDEBAR (ADMIN POLISH) ---
// Note: Normally you would update components/Sidebar.tsx, but I will include the structure here logic-wise
// You should update your Sidebar component to have Polish text: "Panel Główny", "Wyloguj", etc.

// --- HELPERS ---
const formatMoney = (amount: number) => 
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount)

const formatPercent = (part: number, total: number) => {
  if (total === 0) return '0.0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

// KPI Component
const KPICard = ({ title, actual, plan, inverse = false, isCurrency = false }: any) => {
  const diff = actual - plan
  const variance = plan > 0 ? (diff / plan) : 0
  let status = 'OK', color = 'text-green-600', bg = 'bg-green-100'

  if (!inverse) {
    if (variance < -0.10) { status = 'ALERT'; color = 'text-red-600'; bg = 'bg-red-100' }
    else if (variance < 0) { status = 'UWAGA'; color = 'text-yellow-600'; bg = 'bg-yellow-100' }
  } else {
    if (variance > 0.10) { status = 'ALERT'; color = 'text-red-600'; bg = 'bg-red-100' }
    else if (variance > 0) { status = 'UWAGA'; color = 'text-yellow-600'; bg = 'bg-yellow-100' }
  }

  return (
    <Card className="border-slate-200 shadow-sm relative overflow-hidden">
      <div className={`absolute top-4 right-4 px-2 py-1 rounded text-[10px] font-bold ${bg} ${color}`}>{status}</div>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900 mb-1">{isCurrency ? formatMoney(actual) : actual}</div>
        <div className="text-sm text-slate-500 mb-4">Plan: <span className="font-medium">{isCurrency ? formatMoney(plan) : plan}</span></div>
        <div className="flex items-center gap-2 text-xs font-medium border-l-4 pl-2 border-slate-200">
           <span className={color}>{variance > 0 ? '+' : ''}{(variance * 100).toFixed(1)}%</span><span className="text-slate-400">odchylenie</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState('') 
  const [dateLabel, setDateLabel] = useState('')
  const [locations, setLocations] = useState<any[]>([])
  const [filterLocationId, setFilterLocationId] = useState('all') 

  const [pnl, setPnl] = useState({
    revenue: 0, targetRevenue: 0,
    transactions: 0, targetTx: 0,
    cogs: 0, labor: 0, opex: 0,
    totalCosts: 0, netProfit: 0
  })

  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])
  const [importedCosts, setImportedCosts] = useState<any[]>([])
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([])

  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0]
      setSelectedDate(today)
      const { data } = await supabase.from('locations').select('id, name')
      if (data) setLocations(data)
    }
    init()
  }, [])

  useEffect(() => {
    if (selectedDate) fetchData()
  }, [period, selectedDate, filterLocationId]) 

  const getDateRange = () => {
    const target = selectedDate || new Date().toISOString().split('T')[0]
    const anchor = new Date(target)
    let start = target, end = target, label = `Dzień: ${target}`

    if (period === 'weekly') {
      const day = anchor.getDay()
      const diff = anchor.getDate() - day + (day === 0 ? -6 : 1) 
      const startObj = new Date(anchor); startObj.setDate(diff)
      const endObj = new Date(startObj); endObj.setDate(endObj.getDate() + 6)
      start = startObj.toISOString().split('T')[0]; end = endObj.toISOString().split('T')[0]
      label = `Tydzień: ${start} - ${end}`
    } else if (period === 'monthly') {
      const y = anchor.getFullYear(), m = anchor.getMonth()
      start = new Date(y, m, 1).toISOString().split('T')[0]
      end = new Date(y, m + 1, 0).toISOString().split('T')[0]
      label = `Miesiąc: ${anchor.toLocaleString('pl-PL', { month: 'long' })}`
    }
    return { start, end, label }
  }

  const fetchData = async () => {
    setLoading(true)
    const { start, end, label } = getDateRange()
    setDateLabel(label)

    // 1. SALES
    let salesQuery = supabase.from('sales_daily').select('gross_revenue, target_gross_sales, transaction_count, target_transactions, total_labor_hours, avg_hourly_rate').gte('date', start).lte('date', end)
    if (filterLocationId !== 'all') salesQuery = salesQuery.eq('location_id', filterLocationId)
    const { data: sales } = await salesQuery

    const revenue = sales?.reduce((acc, curr) => acc + (curr.gross_revenue || 0), 0) || 0
    const targetRevenue = sales?.reduce((acc, curr) => acc + (curr.target_gross_sales || 0), 0) || 0
    const transactions = sales?.reduce((acc, curr) => acc + (curr.transaction_count || 0), 0) || 0
    const targetTx = sales?.reduce((acc, curr) => acc + (curr.target_transactions || 0), 0) || 0

    // LABOR
    const labor = sales?.reduce((acc, curr) => acc + ((curr.total_labor_hours || 0) * (curr.avg_hourly_rate || 0)), 0) || 0

    // 2. EXCEL
    let excelQuery = supabase.from('imported_costs').select('amount, cost_type').gte('cost_date', start).lte('cost_date', end)
    if (filterLocationId !== 'all') excelQuery = excelQuery.eq('location_id', filterLocationId)
    const { data: imported } = await excelQuery
    let cogs = 0, opexExcel = 0
    imported?.forEach(c => { if (c.cost_type === 'COS') cogs += (c.amount || 0); else opexExcel += (c.amount || 0) })

    // 3. MANUAL
    let manualQuery = supabase.from('invoices').select('total_amount').eq('status', 'approved').gte('service_date', start).lte('service_date', end)
    if (filterLocationId !== 'all') manualQuery = manualQuery.eq('location_id', filterLocationId)
    const { data: manual } = await manualQuery
    const opexManual = manual?.reduce((acc, curr) => acc + (curr.total_amount || 0), 0) || 0
    const opex = opexExcel + opexManual

    // 4. TOTALS
    const totalCosts = cogs + labor + opex
    const netProfit = revenue - totalCosts

    setPnl({ revenue, targetRevenue, transactions, targetTx, cogs, labor, opex, totalCosts, netProfit })

    // 5. LISTS
    let pendingQuery = supabase.from('invoices').select('*, locations(name)').eq('status', 'submitted').order('service_date', { ascending: false })
    if (filterLocationId !== 'all') pendingQuery = pendingQuery.eq('location_id', filterLocationId)
    const { data: pending } = await pendingQuery
    if (pending) setPendingInvoices(pending)

    let excelListQuery = supabase.from('imported_costs').select('*, locations(name)').gte('cost_date', start).lte('cost_date', end).limit(100)
    if (filterLocationId !== 'all') excelListQuery = excelListQuery.eq('location_id', filterLocationId)
    const { data: excel } = await excelListQuery
    if (excel) setImportedCosts(excel)

    let histQuery = supabase.from('invoices').select('*, locations(name)').in('status', ['approved', 'declined']).gte('service_date', start).lte('service_date', end)
    if (filterLocationId !== 'all') histQuery = histQuery.eq('location_id', filterLocationId)
    const { data: hist } = await histQuery
    if (hist) setHistoryInvoices(hist)

    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('invoices').update({ status }).eq('id', id)
    fetchData() 
  }

  if (!selectedDate) return <div className="ml-64 p-8">Inicjalizacja...</div>

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        
        {/* HEADER */}
        <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Panel Kontrolny</h1>
            <p className="text-slate-500 mt-1">Przegląd Operacyjny i Finansowy</p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-3 h-10 shadow-sm w-full md:w-auto">
              <MapPin className="w-4 h-4 text-slate-500" />
              <select value={filterLocationId} onChange={(e) => setFilterLocationId(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer outline-none w-40">
                <option value="all">Wszystkie Lokale</option>
                {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
              </select>
            </div>

            <div className="flex items-center gap-2">
               <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-2 h-10 shadow-sm">
                 <Calendar className="w-4 h-4 text-slate-500" />
                 <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-none h-8 w-32 focus:ring-0 p-0 text-sm" />
               </div>
               <div className="flex bg-white rounded-md border border-slate-200 p-1 shadow-sm h-10">
                {[{k:'daily', l:'Dzień'}, {k:'weekly', l:'Tydzień'}, {k:'monthly', l:'Miesiąc'}].map((v) => (
                  // @ts-ignore
                  <button key={v.k} onClick={() => setPeriod(v.k)} className={`px-3 py-1 text-xs font-medium rounded transition-all capitalize ${period === v.k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{v.l}</button>
                ))}
               </div>
            </div>
          </div>
        </div>

        {/* CONTEXT BANNER */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg mb-6 flex items-center gap-3 shadow-sm">
          <Filter className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-700">Widok: <span className="font-bold text-slate-900">{filterLocationId === 'all' ? 'Wszystkie Lokale' : locations.find(l => l.id === filterLocationId)?.name}</span> <span className="mx-2 text-slate-300">|</span> {dateLabel}</span>
          {loading && <span className="ml-auto text-sm text-blue-600 font-medium animate-pulse">Odświeżanie...</span>}
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-transparent p-0 border-b border-slate-200 w-full justify-start rounded-none h-auto">
            <TabsTrigger value="dashboard" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900">Panel Główny</TabsTrigger>
            <TabsTrigger value="pnl" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900">Raport P&L</TabsTrigger>
            <TabsTrigger value="imported" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900">Dane Excel</TabsTrigger>
            <TabsTrigger value="approvals" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900">Do Akceptacji {pendingInvoices.length > 0 && <span className="ml-2 bg-red-100 text-red-600 px-2 rounded-full text-xs">{pendingInvoices.length}</span>}</TabsTrigger>
            <TabsTrigger value="history" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900">Historia</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard title="Sprzedaż Całkowita" actual={pnl.revenue} plan={pnl.targetRevenue} isCurrency />
              <KPICard title="Transakcje" actual={pnl.transactions} plan={pnl.targetTx} />
              <KPICard title="Koszt Pracy (Robocizna)" actual={pnl.labor} plan={pnl.targetRevenue * 0.28} isCurrency inverse /> 
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Marża Brutto</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-900">{formatMoney(pnl.revenue - pnl.cogs)}</div><p className="text-xs text-slate-500 mt-1">{formatPercent(pnl.revenue - pnl.cogs, pnl.revenue)} sprzedaży</p></CardContent></Card>
              <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Koszty Całkowite</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{formatMoney(pnl.totalCosts)}</div><p className="text-xs text-slate-500 mt-1">Praca + COGS + OPEX</p></CardContent></Card>
              <Card className="md:col-span-2 border-slate-200 shadow-sm bg-slate-50"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Zysk Netto</CardTitle></CardHeader><CardContent><div className={`text-4xl font-bold ${pnl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(pnl.netProfit)}</div><div className="flex gap-4 mt-2 text-sm text-slate-600"><span>Marża Netto: <b>{formatPercent(pnl.netProfit, pnl.revenue)}</b></span></div></CardContent></Card>
            </div>
          </TabsContent>

          {/* P&L */}
          <TabsContent value="pnl">
            <Card className="border-slate-200 shadow-sm overflow-hidden max-w-5xl">
              <CardContent className="p-0">
                <div className="p-8">
                  <h3 className="font-bold text-lg text-slate-900 mb-6">Rachunek Zysków i Strat (P&L)</h3>
                  <div className="flex justify-between items-center py-4 border-b border-slate-100"><span className="font-bold text-slate-800 text-lg">Utarg Brutto (Przychód)</span><span className="font-bold text-slate-900 text-xl">{formatMoney(pnl.revenue)}</span></div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-700">Koszt Wsadu (COGS)</span><div className="text-right"><span className="font-mono text-slate-900 mr-4">{formatMoney(pnl.cogs)}</span><span className="text-xs text-slate-500 font-medium">({formatPercent(pnl.cogs, pnl.revenue)})</span></div></div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-700">Koszt Pracy (Godziny × Stawka)</span><div className="text-right"><span className="font-mono text-slate-900 mr-4">{formatMoney(pnl.labor)}</span><span className="text-xs text-slate-500 font-medium">({formatPercent(pnl.labor, pnl.revenue)})</span></div></div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-700">Koszty Operacyjne (OPEX)</span><div className="text-right"><span className="font-mono text-slate-900 mr-4">{formatMoney(pnl.opex)}</span><span className="text-xs text-slate-500 font-medium">({formatPercent(pnl.opex, pnl.revenue)})</span></div></div>
                  <div className="flex justify-between items-center py-4 bg-slate-50 -mx-8 px-8 border-t border-slate-200 mt-2"><span className="font-bold text-slate-800">Suma Kosztów</span><span className="font-bold text-slate-900">{formatMoney(pnl.totalCosts)}</span></div>
                  <div className="flex justify-between items-center py-4"><span className="font-bold text-xl text-slate-900">Zysk Netto</span><span className={`font-bold text-2xl ${pnl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(pnl.netProfit)}</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXCEL IMPORT */}
          <TabsContent value="imported">
            <Card>
              <CardHeader><CardTitle>Dane z Excela ({importedCosts.length} rekordów)</CardTitle></CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Lokal</th><th className="p-3">Dostawca</th><th className="p-3">Konto (RK)</th><th className="p-3">Typ</th><th className="p-3 text-right">Kwota</th></tr></thead>
                    <tbody>
                      {importedCosts.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Brak danych dla wybranego okresu.</td></tr>}
                      {importedCosts.map((item, idx) => (
                        <tr key={idx} className="border-t hover:bg-slate-50">
                          <td className="p-3">{item.cost_date}</td>
                          <td className="p-3 font-medium">{item.locations?.name}</td>
                          <td className="p-3">{item.supplier}</td>
                          <td className="p-3 text-slate-600 max-w-[200px] truncate">{item.account_description}</td>
                          <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{item.cost_type}</span></td>
                          <td className="p-3 text-right font-mono">{formatMoney(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals">
            <Card>
               <CardHeader><CardTitle>Oczekujące na Akceptację</CardTitle></CardHeader>
               <CardContent>
                 {pendingInvoices.length === 0 && <p className="text-slate-500 py-4 italic text-center">Brak oczekujących faktur.</p>}
                 {pendingInvoices.map(inv => (
                   <div key={inv.id} className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50">
                      <div><p className="font-bold">{inv.supplier_name}</p><p className="text-sm text-slate-500">{formatMoney(inv.total_amount)} • {inv.locations?.name} • {inv.service_date}</p>{inv.attachment_url && <a href={inv.attachment_url} target="_blank" className="text-xs text-blue-600 hover:underline">Zobacz Rachunek</a>}</div>
                      <div className="flex gap-2"><Button variant="destructive" size="sm" onClick={() => updateStatus(inv.id, 'declined')}>Odrzuć</Button><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus(inv.id, 'approved')}>Zatwierdź</Button></div>
                   </div>
                 ))}
               </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history">
            <Card>
               <CardHeader><CardTitle>Historia Faktur (Wybrany Okres)</CardTitle></CardHeader>
               <CardContent>
                 {historyInvoices.length === 0 && <p className="text-slate-500 py-4 italic text-center">Brak historii.</p>}
                 {historyInvoices.map(inv => (
                   <div key={inv.id} className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50 opacity-90">
                      <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${inv.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`}></div><div><p className="font-bold">{inv.supplier_name}</p><p className="text-sm text-slate-500">{formatMoney(inv.total_amount)} • {inv.service_date}</p></div></div>
                      <span className="text-xs font-bold uppercase">{inv.status === 'approved' ? 'Zatwierdzona' : 'Odrzucona'}</span>
                   </div>
                 ))}
               </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  )
}