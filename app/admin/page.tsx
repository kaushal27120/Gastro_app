'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../supabase-client'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Filter, MapPin, AlertTriangle, CheckCircle } from 'lucide-react'

// === CONSTANTS (you can tune these) ===
const VAT_RATE = 0.08                 // for net = gross / (1 + VAT)
const LABOR_PLAN_PERCENT = 0.25       // target labor cost % of net sales
const LABOR_GREEN_MAX = 0.27          // <27% OK
const LABOR_YELLOW_MAX = 0.30         // 27–30% warning
const GROSS_MARGIN_PLAN_PERCENT = 0.63 // 63% target gross margin

// === HELPERS ===
const formatMoney0 = (amount: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(amount || 0)

const formatMoney2 = (amount: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 2,
  }).format(amount || 0)

const formatPercent = (value: number) =>
  (value * 100).toFixed(1).replace('.', ',') + '%'

type LocationRow = { id: string; name: string }

export default function AdminDashboard() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState('')
  const [dateLabel, setDateLabel] = useState('')

  const [locations, setLocations] = useState<LocationRow[]>([])
  const [filterLocationId, setFilterLocationId] = useState<'all' | string>('all')

  const [pnl, setPnl] = useState({
    netSales: 0,
    grossSales: 0,
    vatValue: 0,
    planNet: 0,
    planGross: 0,
    transactions: 0,
    planTransactions: 0,
    aov: 0,
    salesPerHour: 0,
    laborCost: 0,
    laborPercent: 0,
    totalHours: 0,
    effectiveHourlyRate: 0,
    cogs: 0,
    cogsPercent: 0,
    opex: 0,
    totalCosts: 0,
    grossMarginValue: 0,
    grossMarginPercent: 0,
    operatingProfit: 0,
    netMargin: 0,
    // new sums from daily report
    cashDiffTotal: 0,
    pettySum: 0,
    lossesSum: 0,
    refundsSum: 0,
  })

  const [alerts, setAlerts] = useState<string[]>([])
  const [statusText, setStatusText] = useState('')

  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])
  const [importedCosts, setImportedCosts] = useState<any[]>([])
  const [historyInvoices, setHistoryInvoices] = useState<any[]>([])

  // === INITIALIZATION ===
  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0]
      setSelectedDate(today)

      const { data } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true })

      if (data) setLocations(data as LocationRow[])
    }
    init()
  }, [supabase])

  // === REFRESH ON FILTER CHANGE ===
  useEffect(() => {
    if (selectedDate) fetchData()
  }, [period, selectedDate, filterLocationId])

  // === DATE RANGE CALC ===
  const getDateRange = () => {
    const base = selectedDate || new Date().toISOString().split('T')[0]
    const anchor = new Date(base)

    let start = base
    let end = base
    let label = `Dzień: ${base}`

    if (period === 'weekly') {
      const day = anchor.getDay()
      const diff = anchor.getDate() - day + (day === 0 ? -6 : 1)
      const startObj = new Date(anchor)
      startObj.setDate(diff)
      const endObj = new Date(startObj)
      endObj.setDate(endObj.getDate() + 6)
      start = startObj.toISOString().split('T')[0]
      end = endObj.toISOString().split('T')[0]
      label = `Tydzień: ${start} – ${end}`
    } else if (period === 'monthly') {
      const y = anchor.getFullYear()
      const m = anchor.getMonth()
      const startObj = new Date(y, m, 1)
      const endObj = new Date(y, m + 1, 0)
      start = startObj.toISOString().split('T')[0]
      end = endObj.toISOString().split('T')[0]
      label = `Miesiąc: ${startObj.toLocaleString('pl-PL', {
        month: 'long',
        year: 'numeric',
      })}`
    }

    return { start, end, label }
  }

  // === FETCH DATA ===
  const fetchData = async () => {
    setLoading(true)
    const { start, end, label } = getDateRange()
    setDateLabel(label)

    // 1. Sales & labor from daily reports
    let salesQuery = supabase
      .from('sales_daily')
      .select(
        'gross_revenue, target_gross_sales, transaction_count, target_transactions, total_labor_hours, avg_hourly_rate, net_revenue, cash_diff, petty_expenses, daily_losses, daily_refunds',
      )
      .gte('date', start)
      .lte('date', end)

    if (filterLocationId !== 'all') {
      salesQuery = salesQuery.eq('location_id', filterLocationId)
    }

    const { data: sales } = await salesQuery

    const grossSales =
      sales?.reduce((s, r) => s + (Number(r.gross_revenue) || 0), 0) || 0
    const targetGross =
      sales?.reduce((s, r) => s + (Number(r.target_gross_sales) || 0), 0) || 0

    const netFromColumn =
      sales?.reduce((s, r) => s + (Number(r.net_revenue) || 0), 0) || 0
    const netSales =
      netFromColumn > 0 ? netFromColumn : grossSales / (1 + VAT_RATE)
    const planNet = targetGross / (1 + VAT_RATE)
    const vatValue = grossSales - netSales

    const transactions =
      sales?.reduce((s, r) => s + (Number(r.transaction_count) || 0), 0) || 0
    const planTransactions =
      sales?.reduce((s, r) => s + (Number(r.target_transactions) || 0), 0) || 0

    const totalHours =
      sales?.reduce((s, r) => s + (Number(r.total_labor_hours) || 0), 0) || 0

    const laborCost =
      sales?.reduce((s, r) => {
        const h = Number(r.total_labor_hours) || 0
        const rate = Number(r.avg_hourly_rate) || 0
        return s + h * rate
      }, 0) || 0

    const laborPercent = netSales > 0 ? laborCost / netSales : 0
    const aov = transactions > 0 ? netSales / transactions : 0
    const salesPerHour = totalHours > 0 ? netSales / totalHours : 0
    const effectiveHourlyRate =
      totalHours > 0 ? laborCost / totalHours : 0

    // NEW: sums of cash diff & daily op costs
    const cashDiffTotal =
      sales?.reduce((s, r) => s + (Number(r.cash_diff) || 0), 0) || 0
    const pettySum =
      sales?.reduce((s, r) => s + (Number(r.petty_expenses) || 0), 0) || 0
    const lossesSum =
      sales?.reduce((s, r) => s + (Number(r.daily_losses) || 0), 0) || 0
    const refundsSum =
      sales?.reduce((s, r) => s + (Number(r.daily_refunds) || 0), 0) || 0
    const opsExtraOpex = pettySum + lossesSum + refundsSum

    // 2. Imported costs (Excel)
    let costQuery = supabase
      .from('imported_costs')
      .select('amount, cost_type')
      .gte('cost_date', start)
      .lte('cost_date', end)
    if (filterLocationId !== 'all') {
      costQuery = costQuery.eq('location_id', filterLocationId)
    }
    const { data: imported } = await costQuery

    let cogs = 0
    let opexExcel = 0
    imported?.forEach(c => {
      const amt = Number(c.amount) || 0
      if (c.cost_type === 'COS') cogs += amt
      else opexExcel += amt
    })

    // 3. Approved invoices
    let manualQuery = supabase
      .from('invoices')
      .select('total_amount')
      .eq('status', 'approved')
      .gte('service_date', start)
      .lte('service_date', end)
    if (filterLocationId !== 'all') {
      manualQuery = manualQuery.eq('location_id', filterLocationId)
    }
    const { data: manual } = await manualQuery
    const opexManual =
      manual?.reduce((s, r) => s + (Number(r.total_amount) || 0), 0) || 0

    const opex = opexExcel + opexManual + opsExtraOpex

    // 4. Derived margins / result
    const cogsPercent = netSales > 0 ? cogs / netSales : 0
    const grossMarginValue = netSales - cogs
    const grossMarginPercent =
      netSales > 0 ? grossMarginValue / netSales : 0

    const totalCosts = cogs + laborCost + opex
    const operatingProfit = netSales - cogs - laborCost - opex
    const netMargin =
      netSales > 0 ? operatingProfit / netSales : 0

    // 5. Alerts & status
    const newAlerts: string[] = []

    if (laborPercent > LABOR_YELLOW_MAX) {
      newAlerts.push('Koszt pracy powyżej 30% sprzedaży netto')
    } else if (laborPercent > LABOR_GREEN_MAX) {
      newAlerts.push('Koszt pracy zbliża się do 30% sprzedaży netto')
    }

    if (grossMarginPercent < GROSS_MARGIN_PLAN_PERCENT - 0.02) {
      newAlerts.push('Marża brutto niższa od planu o więcej niż 2 pp')
    }

    if (planNet > 0 && netSales < planNet * 0.97) {
      newAlerts.push('Sprzedaż netto poniżej planu o więcej niż 3%')
    }

    if (Math.abs(cashDiffTotal) > 0.01) {
      newAlerts.push('Różnica w gotówce (stan raport vs fizyczny)')
    }

    let status = ''
    if (operatingProfit >= 0 && newAlerts.length === 0) {
      status = 'DZISIEJSZY STATUS: Rentowność OK. Brak krytycznych odchyleń.'
    } else {
      status =
        'DZISIEJSZY STATUS: Uwaga – główny problem: ' +
        (newAlerts[0] || 'brak danych')
    }

    setPnl({
      netSales,
      grossSales,
      vatValue,
      planNet,
      planGross: targetGross,
      transactions,
      planTransactions,
      aov,
      salesPerHour,
      laborCost,
      laborPercent,
      totalHours,
      effectiveHourlyRate,
      cogs,
      cogsPercent,
      opex,
      totalCosts,
      grossMarginValue,
      grossMarginPercent,
      operatingProfit,
      netMargin,
      cashDiffTotal,
      pettySum,
      lossesSum,
      refundsSum,
    })

    setAlerts(newAlerts)
    setStatusText(status)

    // 6. Pending / imported list / history
    let pendingQuery = supabase
      .from('invoices')
      .select('*, locations(name)')
      .eq('status', 'submitted')
      .order('service_date', { ascending: false })
    if (filterLocationId !== 'all') {
      pendingQuery = pendingQuery.eq('location_id', filterLocationId)
    }
    const { data: pending } = await pendingQuery
    if (pending) setPendingInvoices(pending)

    let importedListQuery = supabase
      .from('imported_costs')
      .select('*, locations(name)')
      .gte('cost_date', start)
      .lte('cost_date', end)
      .limit(100)
    if (filterLocationId !== 'all') {
      importedListQuery = importedListQuery.eq('location_id', filterLocationId)
    }
    const { data: importedList } = await importedListQuery
    if (importedList) setImportedCosts(importedList)

    let histQuery = supabase
      .from('invoices')
      .select('*, locations(name)')
      .in('status', ['approved', 'declined'])
      .gte('service_date', start)
      .lte('service_date', end)
    if (filterLocationId !== 'all') {
      histQuery = histQuery.eq('location_id', filterLocationId)
    }
    const { data: hist } = await histQuery
    if (hist) setHistoryInvoices(hist)

    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('invoices').update({ status }).eq('id', id)
    fetchData()
  }

  // === RENDER ===
  if (!selectedDate) return <div className="ml-64 p-8">Inicjalizacja…</div>

  const laborColorClass =
    pnl.laborPercent < LABOR_GREEN_MAX
      ? 'text-green-700 bg-green-50 border-green-200'
      : pnl.laborPercent <= LABOR_YELLOW_MAX
      ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
      : 'text-red-700 bg-red-50 border-red-200'

  const cashDiffColor =
    Math.abs(pnl.cashDiffTotal) < 0.01 ? 'text-green-700' : 'text-red-700'

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {/* HEADER */}
        <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Panel właściciela
            </h1>
            <p className="text-slate-500 mt-1">
              Sprzedaż → Produktywność → Marża → Wynik → Alerty
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* LOCATION FILTER */}
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-3 h-10 shadow-sm w-full md:w-auto">
              <MapPin className="w-4 h-4 text-slate-500" />
              <select
                value={filterLocationId}
                onChange={e =>
                  setFilterLocationId(
                    e.target.value === 'all' ? 'all' : e.target.value,
                  )
                }
                className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer outline-none w-48"
              >
                <option value="all">Wszystkie lokalizacje</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* DATE + PERIOD */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-2 h-10 shadow-sm">
                <Calendar className="w-4 h-4 text-slate-500" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="border-none h-8 w-32 focus:ring-0 p-0 text-sm"
                />
              </div>

              <div className="flex bg-white rounded-md border border-slate-200 p-1 shadow-sm h-10">
                {['daily', 'weekly', 'monthly'].map(v => (
                  <button
                    key={v}
                    onClick={() => setPeriod(v as any)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                      period === v
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {v === 'daily'
                      ? 'Dzień'
                      : v === 'weekly'
                      ? 'Tydzień'
                      : 'Miesiąc'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTEXT BAR */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg mb-6 flex items-center gap-3 shadow-sm">
          <Filter className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-700">
            Lokalizacja:{' '}
            <span className="font-bold text-slate-900">
              {filterLocationId === 'all'
                ? 'Wszystkie'
                : locations.find(l => l.id === filterLocationId)?.name}
            </span>
            <span className="mx-2 text-slate-300">|</span>
            {dateLabel}
          </span>
          {loading && (
            <span className="ml-auto text-sm text-blue-600 font-medium animate-pulse">
              Odświeżanie danych…
            </span>
          )}
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-transparent p-0 border-b border-slate-200 w-full justify-start rounded-none h-auto">
            <TabsTrigger
              value="dashboard"
              className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900"
            >
              Dashboard operacyjny
            </TabsTrigger>
            <TabsTrigger
              value="pnl"
              className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900"
            >
              Raport P&L
            </TabsTrigger>
            <TabsTrigger
              value="imported"
              className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900"
            >
              Dane z Excela
            </TabsTrigger>
            <TabsTrigger
              value="approvals"
              className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900"
            >
              Zatwierdzenia{' '}
              {pendingInvoices.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 px-2 rounded-full text-xs">
                  {pendingInvoices.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent font-medium text-slate-600 data-[state=active]:text-slate-900"
            >
              Historia faktur
            </TabsTrigger>
          </TabsList>

          {/* === DASHBOARD TAB === */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* ROW 1: SALES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Net & Gross */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Sprzedaż netto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatMoney0(pnl.netSales)}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>
                      Sprzedaż brutto:{' '}
                      <span className="font-medium">
                        {formatMoney0(pnl.grossSales)}
                      </span>
                    </div>
                    <div>
                      VAT:{' '}
                      <span className="font-medium">
                        {formatMoney0(pnl.vatValue)}
                      </span>
                    </div>
                    <div>
                      Plan netto:{' '}
                      <span className="font-medium">
                        {formatMoney0(pnl.planNet)}
                      </span>
                    </div>
                    <div>
                      Realizacja planu:{' '}
                      <span className="font-bold">
                        {pnl.planNet > 0
                          ? formatPercent(pnl.netSales / pnl.planNet)
                          : '0,0%'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AOV */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Średni paragon (AOV)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatMoney2(pnl.aov)}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>
                      Sprzedaż netto:{' '}
                      <span className="font-medium">
                        {formatMoney0(pnl.netSales)}
                      </span>
                    </div>
                    <div>
                      Transakcji:{' '}
                      <span className="font-medium">
                        {pnl.transactions}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Transakcje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {pnl.transactions}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>
                      Plan:{' '}
                      <span className="font-medium">
                        {pnl.planTransactions}
                      </span>
                    </div>
                    <div>
                      Odchylenie:{' '}
                      <span className="font-medium">
                        {pnl.transactions - pnl.planTransactions}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sales per hour */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Sprzedaż na roboczogodzinę
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatMoney2(pnl.salesPerHour)}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>
                      Sprzedaż netto:{' '}
                      <span className="font-medium">
                        {formatMoney0(pnl.netSales)}
                      </span>
                    </div>
                    <div>
                      Godziny pracy:{' '}
                      <span className="font-medium">
                        {pnl.totalHours.toFixed(1)} h
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ROW 2: PRODUCTIVITY */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Labor */}
              <Card className={`border ${laborColorClass} shadow-sm`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Koszt pracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-1">
                    {formatMoney0(pnl.laborCost)}
                  </div>
                  <div className="text-sm font-bold mb-1">
                    {formatPercent(pnl.laborPercent)} sprzedaży netto
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>
                      Plan:{' '}
                      <span className="font-medium">
                        {formatPercent(LABOR_PLAN_PERCENT)}
                      </span>
                    </div>
                    <div>
                      Odchylenie:{' '}
                      <span className="font-medium">
                        {(
                          (pnl.laborPercent - LABOR_PLAN_PERCENT) *
                          100
                        ).toFixed(1)}{' '}
                        pp
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* COGS */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    COGS (koszt towaru)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatPercent(pnl.cogsPercent)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Wartość:{' '}
                    <span className="font-medium text-slate-700">
                      {formatMoney0(pnl.cogs)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Effective rate / hours */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Koszt pracy na godzinę
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatMoney2(pnl.effectiveHourlyRate)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Godziny przepracowane:{' '}
                    <span className="font-medium text-slate-700">
                      {pnl.totalHours.toFixed(1)} h
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* OPEX */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    OPEX (pozostałe koszty)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600 mb-1">
                    {formatMoney0(pnl.opex)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Excel SEMIS + faktury + koszty dnia z raportu
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ROW 3: RESULT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Gross margin */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Marża brutto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatMoney0(pnl.grossMarginValue)}
                  </div>
                  <div className="text-sm font-bold mb-1">
                    {formatPercent(pnl.grossMarginPercent)} sprzedaży netto
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div>
                      Plan:{' '}
                      <span className="font-medium text-slate-700">
                        {formatPercent(GROSS_MARGIN_PLAN_PERCENT)}
                      </span>
                    </div>
                    <div>
                      Odchylenie:{' '}
                      <span className="font-medium text-slate-700">
                        {(
                          (pnl.grossMarginPercent -
                            GROSS_MARGIN_PLAN_PERCENT) *
                          100
                        ).toFixed(1)}{' '}
                        pp
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total costs % */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Koszty całkowite
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {formatPercent(
                      pnl.netSales > 0 ? pnl.totalCosts / pnl.netSales : 0,
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Wartość:{' '}
                    <span className="font-medium text-slate-700">
                      {formatMoney0(pnl.totalCosts)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* EBIT */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Zysk operacyjny (EBIT lokalu)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-3xl font-bold mb-1 ${
                      pnl.operatingProfit >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatMoney0(pnl.operatingProfit)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Marża operacyjna:{' '}
                    <span className="font-medium text-slate-700">
                      {formatPercent(pnl.netMargin)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Net margin operational */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Marża netto operacyjna
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-3xl font-bold mb-1 ${
                      pnl.netMargin >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatPercent(pnl.netMargin)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Na podstawie zysku operacyjnego lokalu
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ROW 4: STATUS + ALERTY + GOTÓWKA / KOSZTY DNIA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* STATUS */}
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Status dnia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-bold text-slate-900 mb-2">
                    {statusText}
                  </p>
                  <p className="text-xs text-slate-500">
                    Kolejność analizy: Sprzedaż → Produktywność → Marża → Wynik → Alerty.
                  </p>
                </CardContent>
              </Card>

              {/* ALERTY + GOTÓWKA I KOSZTY DNIA */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-1 flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Alerty operacyjne
                  </CardTitle>
                  {alerts.length === 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  {alerts.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-2">
                      Brak aktywnych alertów.
                    </p>
                  )}
                  <ul className="space-y-2 text-sm text-slate-700">
                    {alerts.map((a, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-[3px]" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>

                  {/* extra: cash & daily op costs */}
                  <div className="border-t pt-3 mt-2 text-xs text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">
                      Gotówka i koszty dnia (z raportu dziennego)
                    </p>
                    <p>
                      Różnica gotówki:{' '}
                      <span className={cashDiffColor + ' font-bold'}>
                        {formatMoney2(pnl.cashDiffTotal)}
                      </span>
                    </p>
                    <p>
                      Wydatki drobne:{' '}
                      <span className="font-medium">
                        {formatMoney2(pnl.pettySum)}
                      </span>
                    </p>
                    <p>
                      Straty:{' '}
                      <span className="font-medium">
                        {formatMoney2(pnl.lossesSum)}
                      </span>
                    </p>
                    <p>
                      Zwroty / reklamacje:{' '}
                      <span className="font-medium">
                        {formatMoney2(pnl.refundsSum)}
                      </span>
                    </p>
                    <p>
                      Suma kosztów dnia:{' '}
                      <span className="font-bold">
                        {formatMoney2(
                          pnl.pettySum + pnl.lossesSum + pnl.refundsSum,
                        )}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === P&L TAB === */}
          <TabsContent value="pnl">
            <Card className="border-slate-200 shadow-sm overflow-hidden max-w-5xl">
              <CardContent className="p-0">
                <div className="p-8">
                  <h3 className="font-bold text-lg text-slate-900 mb-6">
                    Raport P&L (na sprzedaży netto)
                  </h3>

                  {/* PRZYCHODY */}
                  <div className="flex justify-between items-end mb-2 border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Przychody
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="font-bold text-slate-800 text-lg">
                      Sprzedaż netto
                    </span>
                    <span className="font-bold text-slate-900 text-xl">
                      {formatMoney0(pnl.netSales)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200 text-xs text-slate-500">
                    <span>Sprzedaż brutto</span>
                    <span>{formatMoney0(pnl.grossSales)}</span>
                  </div>

                  {/* KOSZTY */}
                  <div className="flex justify-between items-end mt-8 mb-2 border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Koszty
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-700">
                      Koszt własny sprzedaży (COGS)
                    </span>
                    <div className="text-right">
                      <span className="font-mono text-slate-900 mr-4">
                        {formatMoney0(pnl.cogs)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium w-16 inline-block text-right">
                        {formatPercent(pnl.cogsPercent)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-700">
                      Koszt pracy (wg raportu dziennego)
                    </span>
                    <div className="text-right">
                      <span className="font-mono text-slate-900 mr-4">
                        {formatMoney0(pnl.laborCost)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium w-16 inline-block text-right">
                        {formatPercent(pnl.laborPercent)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-slate-100">
                    <span className="text-slate-700">
                      Pozostałe koszty operacyjne (OPEX)
                    </span>
                    <div className="text-right">
                      <span className="font-mono text-slate-900 mr-4">
                        {formatMoney0(pnl.opex)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium w-16 inline-block text-right">
                        {formatPercent(
                          pnl.netSales > 0 ? pnl.opex / pnl.netSales : 0,
                        )}
                      </span>
                    </div>
                  </div>

                  {/* DODATKOWE KOSZTY DNIA */}
                  <div className="text-xs text-slate-500 py-3 border-b border-slate-100">
                    <span className="font-semibold">
                      W tym koszty dnia z raportu:
                    </span>{' '}
                    wydatki drobne {formatMoney2(pnl.pettySum)}, straty{' '}
                    {formatMoney2(pnl.lossesSum)}, zwroty{' '}
                    {formatMoney2(pnl.refundsSum)}.
                  </div>

                  <div className="flex justify-between items-center py-4 bg-slate-50 -mx-8 px-8 border-t border-slate-200 mt-2">
                    <span className="font-bold text-slate-800">
                      Suma kosztów
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatMoney0(pnl.totalCosts)}
                    </span>
                  </div>

                  {/* WYNIK */}
                  <div className="flex justify-between items-end mt-8 mb-2 border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Wynik operacyjny
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-4">
                    <span className="font-bold text-xl text-slate-900">
                      EBIT (zysk operacyjny lokalu)
                    </span>
                    <span
                      className={`font-bold text-2xl ${
                        pnl.operatingProfit >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatMoney0(pnl.operatingProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="font-medium text-slate-500">
                      Marża netto operacyjna
                    </span>
                    <span
                      className={`font-bold text-lg ${
                        pnl.netMargin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(pnl.netMargin)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === IMPORTED DATA TAB === */}
          <TabsContent value="imported">
            <Card>
              <CardHeader>
                <CardTitle>
                  Dane kosztowe z Excela ({importedCosts.length} pozycji)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Lokal</th>
                        <th className="p-3">Dostawca</th>
                        <th className="p-3">Opis / RK</th>
                        <th className="p-3">Typ</th>
                        <th className="p-3 text-right">Kwota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedCosts.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-6 text-center text-slate-500"
                          >
                            Brak danych w wybranym okresie.
                          </td>
                        </tr>
                      )}
                      {importedCosts.map((item, idx) => (
                        <tr
                          key={idx}
                          className="border-t hover:bg-slate-50 transition-colors"
                        >
                          <td className="p-3">{item.cost_date}</td>
                          <td className="p-3 font-medium">
                            {item.locations?.name}
                          </td>
                          <td className="p-3">{item.supplier}</td>
                          <td className="p-3 text-slate-600 max-w-[220px] truncate">
                            {item.account_description}
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                              {item.cost_type}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {item.amount} zł
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === APPROVALS TAB === */}
          <TabsContent value="approvals">
            <Card>
              <CardHeader>
                <CardTitle>Faktury oczekujące na zatwierdzenie</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingInvoices.length === 0 && (
                  <p className="text-slate-500 py-4 italic text-center">
                    Brak faktur do zatwierdzenia.
                  </p>
                )}
                {pendingInvoices.map(inv => (
                  <div
                    key={inv.id}
                    className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-bold">{inv.supplier_name}</p>
                      <p className="text-sm text-slate-500">
                        {inv.locations?.name} • {inv.service_date} •{' '}
                        {formatMoney0(inv.total_amount)}
                      </p>
                      {inv.attachment_url && (
                        <a
                          href={inv.attachment_url}
                          target="_blank"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Podgląd skanu / zdjęcia
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => updateStatus(inv.id, 'declined')}
                      >
                        Odrzuć
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatus(inv.id, 'approved')}
                      >
                        Zatwierdź
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === HISTORY TAB === */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historia faktur</CardTitle>
              </CardHeader>
              <CardContent>
                {historyInvoices.length === 0 && (
                  <p className="text-slate-500 py-4 italic text-center">
                    Brak historii w wybranym okresie.
                  </p>
                )}
                {historyInvoices.map(inv => (
                  <div
                    key={inv.id}
                    className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50 opacity-90"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          inv.status === 'approved'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <div>
                        <p
                          className={`font-bold ${
                            inv.status === 'declined'
                              ? 'line-through text-slate-400'
                              : 'text-slate-800'
                          }`}
                        >
                          {inv.supplier_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {inv.locations?.name} • {inv.service_date} •{' '}
                          {formatMoney0(inv.total_amount)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase">
                      {inv.status === 'approved'
                        ? 'zatwierdzona'
                        : 'odrzucona'}
                    </span>
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