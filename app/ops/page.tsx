'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '../supabase-client'
import { useRouter } from 'next/navigation'
import { OpsSidebar } from '@/components/OpsSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertCircle, UploadCloud, FileSpreadsheet, Save, CheckCircle, Plus,
  Trash2, AlertTriangle, ShieldAlert, Package, Receipt, FileText,
  ClipboardList, Search, ArrowLeft, Send, Clock, ChevronRight,
  Loader2, Calendar, RefreshCw, CheckCircle2, XCircle, HelpCircle,
  AlertOctagon
} from 'lucide-react'
import * as XLSX from 'xlsx'

/* ================================================================== */
/* TYPES                                                               */
/* ================================================================== */
type LocationData = {
  location_id: string
  locations: { name: string; id: string; company_id: string }
}
type Employee = { id: string; full_name: string; real_hour_cost: number | null }
type EmployeeRow = { employee_id: string; hours: string }
type ValidationError = { field: string; message: string }
type InvoiceLineItem = {
  product: string; cosCategory: string; quantity: string
  unit: string; netPrice: string; vatRate: string
}
type InventoryJob = {
  id: string; location_id: string; type: 'MONTHLY' | 'WEEKLY'
  status: 'draft' | 'submitted' | 'approved' | 'correction'
  due_date: string; created_at: string; created_by: string
  note?: string; submitted_at?: string; submitted_by?: string
  item_count?: number
}
type InventoryJobItem = {
  id: string; job_id: string; product_id: string
  product_name: string; unit: string; category: string
  expected_qty: number | null; counted_qty: string
  note: string; last_price: number | null
}
type SemisReconciliationEntry = {
  id?: string
  location_id: string
  invoice_number: string
  supplier: string
  invoice_date: string
  accounting_account: string
  amount: string
  description: string
  status: 'pending' | 'submitted'
}

type ActiveView = 'reporting' | 'invoices' | 'inventory'

/* ================================================================== */
/* CONSTANTS                                                           */
/* ================================================================== */
const VAT_RATE = 0.08

const COS_CATEGORIES = [
  { value: 'mieso_drob', label: 'Mięso / Drób' },
  { value: 'ryby_owoce_morza', label: 'Ryby / Owoce morza' },
  { value: 'nabial', label: 'Nabiał' },
  { value: 'warzywa_owoce', label: 'Warzywa / Owoce' },
  { value: 'pieczywo', label: 'Pieczywo' },
  { value: 'napoje', label: 'Napoje' },
  { value: 'suche_przyprawy', label: 'Suche / Przyprawy' },
  { value: 'opakowania', label: 'Opakowania' },
  { value: 'inne_cos', label: 'Inne (COS)' },
]

const SEMIS_CATEGORIES = [
  { value: 'czynsz', label: 'Czynsz' },
  { value: 'media', label: 'Media (prąd, woda, gaz)' },
  { value: 'marketing', label: 'Marketing / Reklama' },
  { value: 'serwis_naprawy', label: 'Serwis / Naprawy' },
  { value: 'ubezpieczenia', label: 'Ubezpieczenia' },
  { value: 'it_software', label: 'IT / Software' },
  { value: 'transport', label: 'Transport / Logistyka' },
  { value: 'czystosc_higiena', label: 'Czystość / Higiena' },
  { value: 'administracja', label: 'Administracja' },
  { value: 'inne_semis', label: 'Inne (SEMIS)' },
]

const ACCOUNTING_ACCOUNTS = [
  { value: '401-01', label: '401-01 - Czynsz' },
  { value: '402-01', label: '402-01 - Media' },
  { value: '403-01', label: '403-01 - Marketing' },
  { value: '404-01', label: '404-01 - Serwis' },
  { value: '405-01', label: '405-01 - Ubezpieczenia' },
  { value: '406-01', label: '406-01 - IT/Software' },
  { value: '407-01', label: '407-01 - Transport' },
  { value: '408-01', label: '408-01 - Czystość' },
  { value: '409-01', label: '409-01 - Administracja' },
  { value: '410-01', label: '410-01 - Inne' },
]

const UNITS = [
  { value: 'kg', label: 'kg' }, { value: 'szt', label: 'szt.' },
  { value: 'l', label: 'l' }, { value: 'opak', label: 'opak.' },
  { value: 'but', label: 'but.' }, { value: 'kart', label: 'kart.' },
]

const VAT_RATES = [
  { value: '0', label: '0%' }, { value: '0.05', label: '5%' },
  { value: '0.08', label: '8%' }, { value: '0.23', label: '23%' },
]

const PRODUCT_CATEGORIES = [
  'kawa', 'herbata', 'napoje', 'nabial', 'pieczywo', 'mieso',
  'warzywa', 'owoce', 'suche', 'opakowania', 'dodatki', 'inne'
]

const emptyLineItem: InvoiceLineItem = {
  product: '', cosCategory: '', quantity: '', unit: 'kg', netPrice: '', vatRate: '0.08'
}

const emptySemisReconEntry: SemisReconciliationEntry = {
  location_id: '',
  invoice_number: '',
  supplier: '',
  invoice_date: '',
  accounting_account: '',
  amount: '',
  description: '',
  status: 'pending'
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Robocza', color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Wysłana', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Zatwierdzona', color: 'bg-green-100 text-green-700' },
  correction: { label: 'Do korekty', color: 'bg-red-100 text-red-700' },
}

/* ================================================================== */
/* COMPONENT                                                           */
/* ================================================================== */
export default function OpsDashboard() {
  const supabase = createClient()
  const router = useRouter()

  // ── Core ──
  const [loading, setLoading] = useState(true)
  const [myLocations, setMyLocations] = useState<LocationData[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('reporting')
  const [reportDate, setReportDate] = useState('')
  const [isReadOnly, setIsReadOnly] = useState(false)

  // ── Closing person ──
  const [closingPersonName, setClosingPersonName] = useState('')
  const [closingPersonEmail, setClosingPersonEmail] = useState('')

  // ── Employees (reporting) ──
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([{ employee_id: '', hours: '' }])

  // ── Sales form ──
  const [salesForm, setSalesForm] = useState({
    transactions: '', gross: '', netRevenue: '', card: '', cash: '',
    comments: '', targetGross: '', targetTx: '', totalHoursAgg: '',
    avgRateAgg: '', cashReported: '', cashPhysical: '',
    pettyExpense: '', losses: '', refunds: '',
    incidentType: '', incidentDetails: '',
    staffMorning: '', staffAfternoon: '', staffEvening: '',
    laborExplanation: '', salesDeviationExplanation: '', cashDiffExplanation: '',
  })
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [existingReportId, setExistingReportId] = useState<string | null>(null)

  // ── Invoice state ──
  const [invoiceType, setInvoiceType] = useState<'COS' | 'SEMIS' | ''>('')
  const [invoiceCommon, setInvoiceCommon] = useState({
    supplier: '', invoiceNumber: '', saleDate: '', receiptDate: '',
  })
  const [cosLineItems, setCosLineItems] = useState<InvoiceLineItem[]>([{ ...emptyLineItem }])
  const [semisForm, setSemisForm] = useState({
    totalNet: '', vatRate: '0.23', category: '', description: '',
  })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [invoiceErrors, setInvoiceErrors] = useState<ValidationError[]>([])
  const [excelLoading, setExcelLoading] = useState(false)
  const [invoiceSubView, setInvoiceSubView] = useState<'form' | 'semis_recon'>('form')

  // ── SEMIS Reconciliation Entry ──
  const [semisReconEntries, setSemisReconEntries] = useState<SemisReconciliationEntry[]>([])
  const [newSemisEntry, setNewSemisEntry] = useState<SemisReconciliationEntry>({ ...emptySemisReconEntry })
  const [semisReconSaving, setSemisReconSaving] = useState(false)

  // ── Inventory state ──
  const [inventorySubView, setInventorySubView] = useState<'active' | 'fill' | 'history'>('active')
  const [inventoryJobs, setInventoryJobs] = useState<InventoryJob[]>([])
  const [inventoryHistory, setInventoryHistory] = useState<InventoryJob[]>([])
  const [selectedJob, setSelectedJob] = useState<InventoryJob | null>(null)
  const [jobItems, setJobItems] = useState<InventoryJobItem[]>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('')
  const [inventorySaving, setInventorySaving] = useState(false)

  // ═══════════════════════════════════════════════════════════════════
  // FORMATTING
  // ═══════════════════════════════════════════════════════════════════
  const fmt0 = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(v || 0)
  const fmt2 = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(v || 0)
  const fmtPct = (v: number) => (v * 100).toFixed(1).replace('.', ',') + '%'

  // ═══════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setReportDate(today)
    setInvoiceCommon(p => ({ ...p, saleDate: today, receiptDate: today }))
    setNewSemisEntry(p => ({ ...p, invoice_date: today }))

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setClosingPersonEmail(user.email || '')
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('user_profiles').select('role, full_name').eq('id', user.id).single()
      const role = profile?.role || 'employee'
      setUserRole(role)
      setClosingPersonName(profile?.full_name || user.email || 'Nieznany')
      if (['regional_manager', 'accounting', 'employee'].includes(role)) setIsReadOnly(true)

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

  // ═══════════════════════════════════════════════════════════════════
  // LOAD: Reporting data
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!selectedLocation || !reportDate || activeView !== 'reporting') return
    const fetch = async () => {
      const { data } = await supabase.from('sales_daily').select('*')
        .eq('location_id', selectedLocation.location_id).eq('date', reportDate).single()
      if (data) {
        setSalesForm(p => ({
          ...p,
          transactions: data.transaction_count ?? '', gross: data.gross_revenue ?? '',
          netRevenue: data.net_revenue ?? '', card: data.card_payments ?? '',
          cash: data.cash_payments ?? '', comments: data.comments ?? '',
          targetGross: data.target_gross_sales ?? '', targetTx: data.target_transactions ?? '',
          totalHoursAgg: data.total_labor_hours ?? '', avgRateAgg: data.avg_hourly_rate ?? '',
          cashReported: data.cash_reported ?? '', cashPhysical: data.cash_physical ?? '',
          pettyExpense: data.petty_expenses ?? '', losses: data.daily_losses ?? '',
          refunds: data.daily_refunds ?? '', incidentType: data.incident_type ?? '',
          incidentDetails: data.incident_details ?? '',
          staffMorning: data.staff_morning ?? '', staffAfternoon: data.staff_afternoon ?? '',
          staffEvening: data.staff_evening ?? '',
          laborExplanation: data.labor_explanation ?? '',
          salesDeviationExplanation: data.sales_deviation_explanation ?? '',
          cashDiffExplanation: data.cash_diff_explanation ?? '',
        }))
        setExistingReportId(data.id)
      } else {
        setSalesForm(p => ({
          ...p, transactions: '', gross: '', netRevenue: '', card: '', cash: '',
          comments: '', targetGross: '', targetTx: '', totalHoursAgg: '',
          avgRateAgg: '', cashReported: '', cashPhysical: '', pettyExpense: '',
          losses: '', refunds: '', incidentType: '', incidentDetails: '',
          staffMorning: '', staffAfternoon: '', staffEvening: '',
          laborExplanation: '', salesDeviationExplanation: '', cashDiffExplanation: '',
        }))
        setExistingReportId(null)
      }

      const { data: emps } = await supabase.from('employees')
        .select('id, full_name, real_hour_cost, status')
        .eq('location_id', selectedLocation.location_id)
      if (emps) {
        setEmployees(emps.filter((e: any) => e.status !== 'nieaktywny')
          .map((e: any) => ({ id: e.id, full_name: e.full_name, real_hour_cost: e.real_hour_cost })))
      } else setEmployees([])

      const { data: hrs } = await supabase.from('employee_daily_hours')
        .select('employee_id, hours')
        .eq('location_id', selectedLocation.location_id).eq('date', reportDate)
      if (hrs && hrs.length > 0) {
        setEmployeeRows(hrs.map((r: any) => ({ employee_id: r.employee_id, hours: String(r.hours) })))
      } else setEmployeeRows([{ employee_id: '', hours: '' }])
    }
    fetch()
  }, [selectedLocation, reportDate, activeView, supabase])

  // ═══════════════════════════════════════════════════════════════════
  // LOAD: Inventory data
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!selectedLocation || activeView !== 'inventory') return
    const fetchInventory = async () => {
      // Active jobs
      const { data: active } = await supabase.from('inventory_jobs')
        .select('*, inventory_job_items(count)')
        .eq('location_id', selectedLocation.location_id)
        .in('status', ['draft', 'correction'])
        .order('due_date', { ascending: true })
      if (active) {
        setInventoryJobs(active.map((j: any) => ({
          ...j,
          item_count: j.inventory_job_items?.[0]?.count || 0,
        })))
      }

      // History
      const { data: hist } = await supabase.from('inventory_jobs')
        .select('*, inventory_job_items(count)')
        .eq('location_id', selectedLocation.location_id)
        .in('status', ['submitted', 'approved'])
        .order('created_at', { ascending: false })
        .limit(20)
      if (hist) {
        setInventoryHistory(hist.map((j: any) => ({
          ...j, item_count: j.inventory_job_items?.[0]?.count || 0,
        })))
      }
    }
    fetchInventory()
  }, [selectedLocation, activeView, supabase, inventorySubView])

  // ═══════════════════════════════════════════════════════════════════
  // LOAD: SEMIS Reconciliation entries
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!selectedLocation || activeView !== 'invoices' || invoiceSubView !== 'semis_recon') return
    const fetchSemisRecon = async () => {
      const { data } = await supabase.from('semis_reconciliation_entries')
        .select('*')
        .eq('location_id', selectedLocation.location_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (data) setSemisReconEntries(data as SemisReconciliationEntry[])
    }
    fetchSemisRecon()
  }, [selectedLocation, activeView, invoiceSubView, supabase])

  // ═══════════════════════════════════════════════════════════════════
  // DERIVED KPI VALUES
  // ═══════════════════════════════════════════════════════════════════
  const gross = Number(salesForm.gross) || 0
  const tx = Number(salesForm.transactions) || 0
  const card = Number(salesForm.card) || 0
  const cash = Number(salesForm.cash) || 0
  const planGross = Number(salesForm.targetGross) || 0
  const planTx = Number(salesForm.targetTx) || 0
  const netManual = Number(salesForm.netRevenue) || 0
  const netCalculated = gross > 0 ? gross / (1 + VAT_RATE) : 0
  const net = netManual > 0 ? netManual : netCalculated
  const isNetManual = netManual > 0
  const vat = gross - net
  const cashReported = Number(salesForm.cashReported) || 0
  const cashPhysical = Number(salesForm.cashPhysical) || 0
  const cashDiff = cashPhysical - cashReported
  const pettyExpense = Number(salesForm.pettyExpense) || 0
  const lossesVal = Number(salesForm.losses) || 0
  const refundsVal = Number(salesForm.refunds) || 0
  const dailyOpsTotal = pettyExpense + lossesVal + refundsVal
  const planNet = planGross > 0 ? planGross / (1 + VAT_RATE) : 0
  const planRealisation = planNet > 0 ? net / planNet : 0
  const aov = tx > 0 ? net / tx : 0
  const cardPercent = gross > 0 ? card / gross : 0
  const cashPercent = gross > 0 ? cash / gross : 0

  const employeeTotals = employeeRows.reduce((acc, row) => {
    const h = Number(row.hours) || 0
    if (!row.employee_id || h <= 0) return acc
    const emp = employees.find(e => e.id === row.employee_id)
    acc.totalHours += h; acc.totalCost += h * (emp?.real_hour_cost || 0)
    return acc
  }, { totalHours: 0, totalCost: 0 })

  const hoursAgg = Number(salesForm.totalHoursAgg) || 0
  const rateAgg = Number(salesForm.avgRateAgg) || 0
  const totalHours = employeeTotals.totalHours > 0 ? employeeTotals.totalHours : hoursAgg
  const laborCost = employeeTotals.totalCost > 0 ? employeeTotals.totalCost : hoursAgg * rateAgg
  const laborPercent = net > 0 ? laborCost / net : 0
  const salesPerHour = totalHours > 0 ? net / totalHours : 0
  const effectiveHourlyRate = totalHours > 0 ? laborCost / totalHours : 0
  const staffMorning = Number(salesForm.staffMorning) || 0
  const staffAfternoon = Number(salesForm.staffAfternoon) || 0
  const staffEvening = Number(salesForm.staffEvening) || 0
  const totalStaff = staffMorning + staffAfternoon + staffEvening
  const isLaborAboveThreshold = laborPercent > 0.4 && net > 0
  const isSalesBelow80 = planNet > 0 && planRealisation < 0.8
  const isCashDiffAbove20 = Math.abs(cashDiff) > 20

  // Invoice calcs
  const getLineNet = (i: InvoiceLineItem) => (Number(i.quantity) || 0) * (Number(i.netPrice) || 0)
  const getLineGross = (i: InvoiceLineItem) => getLineNet(i) * (1 + (Number(i.vatRate) || 0))
  const cosTotalNet = cosLineItems.reduce((s, i) => s + getLineNet(i), 0)
  const cosTotalGross = cosLineItems.reduce((s, i) => s + getLineGross(i), 0)
  const cosTotalVat = cosTotalGross - cosTotalNet
  const semisTotalNet = Number(semisForm.totalNet) || 0
  const semisTotalGross = semisTotalNet * (1 + (Number(semisForm.vatRate) || 0))

  // Inventory filtered items
  const filteredJobItems = useMemo(() => {
    let items = jobItems
    if (inventorySearch) {
      const q = inventorySearch.toLowerCase()
      items = items.filter(i => i.product_name.toLowerCase().includes(q))
    }
    if (inventoryCategoryFilter) {
      items = items.filter(i => i.category === inventoryCategoryFilter)
    }
    return items
  }, [jobItems, inventorySearch, inventoryCategoryFilter])

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════
  const validateReport = (): ValidationError[] => {
    const e: ValidationError[] = []
    if (!gross && !netManual) e.push({ field: 'gross', message: 'Utarg brutto lub netto jest wymagany.' })
    if (gross > 0 && Math.abs(card + cash - gross) > 0.5)
      e.push({ field: 'card_cash', message: `Karty + Gotówka ≠ Brutto. Różnica: ${fmt2(Math.abs(card + cash - gross))}` })
    if (net > 0 && tx <= 0) e.push({ field: 'transactions', message: 'Utarg > 0, ale brak transakcji.' })
    if (net > 0 && totalHours <= 0) e.push({ field: 'hours', message: 'Utarg > 0, ale brak godzin pracy.' })
    if (Math.abs(cashDiff) > 0.01 && !salesForm.cashDiffExplanation.trim())
      e.push({ field: 'cashDiffExplanation', message: `Różnica w kasie: ${fmt2(cashDiff)}. Wyjaśnienie wymagane.` })
    if (isLaborAboveThreshold && !salesForm.laborExplanation.trim())
      e.push({ field: 'laborExplanation', message: `Koszt pracy > 40%. Wyjaśnienie wymagane.` })
    if (isSalesBelow80 && !salesForm.salesDeviationExplanation.trim())
      e.push({ field: 'salesDeviationExplanation', message: `Sprzedaż < 80% planu. Wyjaśnienie wymagane.` })
    if (isCashDiffAbove20 && !salesForm.cashDiffExplanation.trim())
      e.push({ field: 'cashDiffExplanation', message: `Różnica w kasie > 20 zł. Wyjaśnienie wymagane.` })
    if (net > 0 && totalStaff <= 0) e.push({ field: 'staff', message: 'Uzupełnij liczbę osób na zmianach.' })
    return e
  }

  const validateInvoice = (): ValidationError[] => {
    const e: ValidationError[] = []
    if (!invoiceType) { e.push({ field: 'invoiceType', message: 'Wybierz typ faktury.' }); return e }
    if (!invoiceCommon.supplier.trim()) e.push({ field: 'supplier', message: 'Dostawca wymagany.' })
    if (!invoiceCommon.invoiceNumber.trim()) e.push({ field: 'invoiceNumber', message: 'Numer faktury wymagany.' })
    if (!invoiceCommon.saleDate) e.push({ field: 'saleDate', message: 'Data sprzedaży wymagana.' })
    if (invoiceType === 'COS') {
      if (!invoiceFile) e.push({ field: 'file', message: 'Załącznik obowiązkowy dla COS.' })
      const valid = cosLineItems.filter(i => i.product.trim() && Number(i.quantity) > 0 && Number(i.netPrice) > 0)
      if (valid.length === 0) e.push({ field: 'lineItems', message: 'Dodaj min. jedną pozycję.' })
      cosLineItems.forEach((i, idx) => {
        if (i.product.trim() && !i.cosCategory) e.push({ field: `lineItem_${idx}`, message: `Poz. ${idx + 1}: brak kategorii COS.` })
      })
    }
    if (invoiceType === 'SEMIS') {
      if (!semisTotalNet) e.push({ field: 'semisAmount', message: 'Kwota netto wymagana.' })
      if (!semisForm.category) e.push({ field: 'semisCategory', message: 'Kategoria wymagana.' })
    }
    return e
  }

  const fieldErr = (f: string) => validationErrors.some(e => e.field === f)
  const invErr = (f: string) => invoiceErrors.some(e => e.field === f)

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS: Reporting
  // ═══════════════════════════════════════════════════════════════════
  const handleReportSubmit = async () => {
    if (isReadOnly || !selectedLocation) return
    const errors = validateReport()
    setValidationErrors(errors)
    if (errors.length > 0) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    const payload: any = {
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      date: reportDate, transaction_count: tx, gross_revenue: gross,
      net_revenue: net, card_payments: card, cash_payments: cash,
      comments: salesForm.comments, target_gross_sales: planGross,
      target_transactions: planTx, total_labor_hours: totalHours,
      avg_hourly_rate: totalHours > 0 ? laborCost / totalHours : 0,
      status: 'submitted', cash_reported: cashReported, cash_physical: cashPhysical,
      cash_diff: cashDiff, petty_expenses: pettyExpense,
      daily_losses: lossesVal, daily_refunds: refundsVal,
      incident_type: salesForm.incidentType, incident_details: salesForm.incidentDetails,
      closing_person: closingPersonName, closing_person_email: closingPersonEmail,
      closing_time: new Date().toISOString(),
      staff_morning: staffMorning, staff_afternoon: staffAfternoon, staff_evening: staffEvening,
      labor_explanation: salesForm.laborExplanation || null,
      sales_deviation_explanation: salesForm.salesDeviationExplanation || null,
      cash_diff_explanation: salesForm.cashDiffExplanation || null,
    }

    const q = existingReportId
      ? supabase.from('sales_daily').update(payload).eq('id', existingReportId)
      : supabase.from('sales_daily').insert(payload)
    const { error } = await q
    if (error) { alert('Błąd: ' + error.message); return }

    const validRows = employeeRows.filter(r => r.employee_id && Number(r.hours) > 0)
    await supabase.from('employee_daily_hours').delete()
      .eq('location_id', selectedLocation.location_id).eq('date', reportDate)
    if (validRows.length > 0) {
      const rows = validRows.map(r => {
        const h = Number(r.hours) || 0
        const emp = employees.find(e => e.id === r.employee_id)
        const rate = emp?.real_hour_cost || 0
        return { date: reportDate, location_id: selectedLocation.location_id,
          employee_id: r.employee_id, hours: h, hour_cost: rate, daily_cost: h * rate }
      })
      const { error: hErr } = await supabase.from('employee_daily_hours').insert(rows)
      if (hErr) { alert('Raport OK, ale błąd godzin: ' + hErr.message); return }
    }

    // Create notification for admin
    await supabase.from('admin_notifications').insert({
      type: 'daily_report',
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      title: `Raport dzienny - ${selectedLocation.locations.name}`,
      message: `Nowy raport za ${reportDate} od ${closingPersonName}`,
      reference_id: existingReportId || null,
      status: 'unread',
      created_by: userId,
    })

    alert('✅ Raport zapisany i wysłany do zatwierdzenia')
    setValidationErrors([])
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS: Invoice
  // ═══════════════════════════════════════════════════════════════════
  const handleInvoiceSubmit = async () => {
    if (!selectedLocation) return
    const errors = validateInvoice()
    setInvoiceErrors(errors)
    if (errors.length > 0) return
    setUploading(true)
    let attachmentUrl: string | null = null
    if (invoiceFile) {
      const ext = invoiceFile.name.split('.').pop()
      const fn = `${selectedLocation.location_id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('invoices').upload(fn, invoiceFile)
      if (upErr) { alert('Błąd pliku: ' + upErr.message); setUploading(false); return }
      attachmentUrl = supabase.storage.from('invoices').getPublicUrl(fn).data.publicUrl
    }

    let invoiceId: string | null = null

    if (invoiceType === 'COS') {
      const { data: inv, error: e } = await supabase.from('invoices').insert({
        location_id: selectedLocation.location_id,
        company_id: selectedLocation.locations.company_id,
        invoice_type: 'COS', supplier_name: invoiceCommon.supplier,
        invoice_number: invoiceCommon.invoiceNumber,
        service_date: invoiceCommon.saleDate, receipt_date: invoiceCommon.receiptDate,
        total_net: cosTotalNet, total_vat: cosTotalVat, total_gross: cosTotalGross,
        payment_method: 'przelew', attachment_url: attachmentUrl, status: 'submitted',
      }).select('id').single()
      if (e) { alert('Błąd: ' + e.message); setUploading(false); return }
      invoiceId = inv?.id
      const valid = cosLineItems.filter(i => i.product.trim() && Number(i.quantity) > 0 && Number(i.netPrice) > 0)
      if (valid.length > 0 && inv) {
        const items = valid.map((i, idx) => ({
          invoice_id: inv.id, line_number: idx + 1, product_name: i.product,
          cos_category: i.cosCategory, quantity: Number(i.quantity), unit: i.unit,
          net_price: Number(i.netPrice), net_value: getLineNet(i),
          vat_rate: Number(i.vatRate), gross_value: getLineGross(i),
        }))
        await supabase.from('invoice_items').insert(items)
      }
      alert(`✅ Faktura COS zapisana (${valid.length} pozycji)`)
    }

    if (invoiceType === 'SEMIS') {
      const { data: inv, error: e } = await supabase.from('invoices').insert({
        location_id: selectedLocation.location_id,
        company_id: selectedLocation.locations.company_id,
        invoice_type: 'SEMIS', supplier_name: invoiceCommon.supplier,
        invoice_number: invoiceCommon.invoiceNumber,
        service_date: invoiceCommon.saleDate, receipt_date: invoiceCommon.receiptDate,
        total_net: semisTotalNet, total_vat: semisTotalGross - semisTotalNet,
        total_gross: semisTotalGross, semis_category: semisForm.category,
        description: semisForm.description, payment_method: 'przelew',
        attachment_url: attachmentUrl, status: 'submitted',
      }).select('id').single()
      if (e) { alert('Błąd: ' + e.message); setUploading(false); return }
      invoiceId = inv?.id
      alert('✅ Faktura SEMIS zapisana')
    }

    // Create notification for admin
    if (invoiceId) {
      await supabase.from('admin_notifications').insert({
        type: 'invoice',
        location_id: selectedLocation.location_id,
        company_id: selectedLocation.locations.company_id,
        title: `Nowa faktura ${invoiceType} - ${selectedLocation.locations.name}`,
        message: `Faktura ${invoiceCommon.invoiceNumber} od ${invoiceCommon.supplier}`,
        reference_id: invoiceId,
        status: 'unread',
        created_by: userId,
      })
    }

    setInvoiceType('')
    setInvoiceCommon({ supplier: '', invoiceNumber: '', saleDate: new Date().toISOString().split('T')[0], receiptDate: new Date().toISOString().split('T')[0] })
    setCosLineItems([{ ...emptyLineItem }])
    setSemisForm({ totalNet: '', vatRate: '0.23', category: '', description: '' })
    setInvoiceFile(null); setInvoiceErrors([]); setUploading(false)
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
        data.forEach(row => {
          const amt = row['PLN Netto'] || row['Netto']; if (!amt) return
          let d = row['Data sprzedaży']
          if (typeof d === 'number') d = new Date((d - 25569) * 86400 * 1000).toISOString().split('T')[0]
          else if (!d) d = new Date().toISOString().split('T')[0]
          const desc = row['RK'] || row['Opis kosztu'] || 'Brak opisu'
          const lower = String(desc).toLowerCase()
          const type = ['food', 'bev', 'meat', 'produce', 'towar'].some(k => lower.includes(k)) ? 'COS' : 'SEMIS'
          rows.push({ location_id: selectedLocation.location_id, cost_date: d,
            supplier: String(row['Sprzedawca'] || 'Nieznany'), account_description: String(desc),
            amount: Number(amt), cost_type: type, source: 'IMPORT_EXCEL' })
        })
        if (rows.length === 0) alert('Brak danych.')
        else { await supabase.from('imported_costs').insert(rows); alert(`✅ ${rows.length} pozycji zaimportowanych`) }
      } catch (err: any) { alert('Błąd: ' + err.message) }
      finally { setExcelLoading(false); e.target.value = null }
    }
    reader.readAsBinaryString(file)
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS: SEMIS Reconciliation Entry
  // ═══════════════════════════════════════════════════════════════════
  const handleAddSemisReconEntry = async () => {
    if (!selectedLocation) return
    if (!newSemisEntry.invoice_number || !newSemisEntry.amount) {
      alert('Wypełnij numer faktury i kwotę')
      return
    }
    setSemisReconSaving(true)
    
    const { error } = await supabase.from('semis_reconciliation_entries').insert({
      ...newSemisEntry,
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      amount: Number(newSemisEntry.amount),
      status: 'pending',
      created_by: userId,
    })
    
    if (error) {
      alert('Błąd: ' + error.message)
    } else {
      alert('✅ Pozycja dodana')
      setNewSemisEntry({ ...emptySemisReconEntry, invoice_date: new Date().toISOString().split('T')[0], location_id: '' })
      // Refresh list
      const { data } = await supabase.from('semis_reconciliation_entries')
        .select('*')
        .eq('location_id', selectedLocation.location_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (data) setSemisReconEntries(data as SemisReconciliationEntry[])
    }
    setSemisReconSaving(false)
  }

  const handleSubmitSemisReconBatch = async () => {
    if (!selectedLocation || semisReconEntries.length === 0) return
    setSemisReconSaving(true)
    
    // Update all pending entries to submitted
    const { error } = await supabase.from('semis_reconciliation_entries')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('location_id', selectedLocation.location_id)
      .eq('status', 'pending')
    
    if (error) {
      alert('Błąd: ' + error.message)
    } else {
      // Create notification for admin
      await supabase.from('admin_notifications').insert({
        type: 'semis_reconciliation',
        location_id: selectedLocation.location_id,
        company_id: selectedLocation.locations.company_id,
        title: `Uzgodnienie SEMIS - ${selectedLocation.locations.name}`,
        message: `${semisReconEntries.length} pozycji do weryfikacji`,
        status: 'unread',
        created_by: userId,
      })
      
      alert('✅ Uzgodnienie wysłane do zatwierdzenia')
      setSemisReconEntries([])
    }
    setSemisReconSaving(false)
  }

  const handleDeleteSemisEntry = async (id: string) => {
    const { error } = await supabase.from('semis_reconciliation_entries').delete().eq('id', id)
    if (!error) {
      setSemisReconEntries(prev => prev.filter(e => e.id !== id))
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS: Inventory
  // ═══════════════════════════════════════════════════════════════════
  const openJob = async (job: InventoryJob) => {
    setSelectedJob(job)
    const { data } = await supabase.from('inventory_job_items')
      .select('*, inventory_products(name, unit, category, last_price)')
      .eq('job_id', job.id)
      .order('inventory_products(category)', { ascending: true })

    if (data) {
      setJobItems(data.map((i: any) => ({
        id: i.id, job_id: i.job_id, product_id: i.product_id,
        product_name: i.inventory_products?.name || 'Nieznany',
        unit: i.inventory_products?.unit || 'szt',
        category: i.inventory_products?.category || 'inne',
        expected_qty: i.expected_qty, counted_qty: i.counted_qty?.toString() || '',
        note: i.note || '',
        last_price: i.inventory_products?.last_price || null,
      })))
    }
    setInventorySubView('fill')
  }

  const updateJobItem = (id: string, field: 'counted_qty' | 'note', val: string) => {
    setJobItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i))
  }

  const saveInventoryDraft = async () => {
    if (!selectedJob) return
    setInventorySaving(true)
    const updates = jobItems.filter(i => i.counted_qty !== '').map(i => ({
      id: i.id, counted_qty: Number(i.counted_qty) || 0, note: i.note,
    }))
    for (const u of updates) {
      await supabase.from('inventory_job_items')
        .update({ counted_qty: u.counted_qty, note: u.note }).eq('id', u.id)
    }
    await supabase.from('inventory_jobs').update({ status: 'draft' }).eq('id', selectedJob.id)
    setInventorySaving(false)
    alert('✅ Zapisano roboczo')
  }

  const submitInventory = async () => {
    if (!selectedJob || !selectedLocation) return
    const empty = jobItems.filter(i => i.counted_qty === '' || i.counted_qty === undefined)
    if (empty.length > 0) {
      alert(`⚠ Uzupełnij stan dla ${empty.length} pozycji przed wysłaniem.`)
      return
    }
    setInventorySaving(true)
    const updates = jobItems.map(i => ({
      id: i.id, counted_qty: Number(i.counted_qty) || 0, note: i.note,
    }))
    for (const u of updates) {
      await supabase.from('inventory_job_items')
        .update({ counted_qty: u.counted_qty, note: u.note }).eq('id', u.id)
    }
    await supabase.from('inventory_jobs').update({
      status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: closingPersonName,
    }).eq('id', selectedJob.id)

    // Create notification for admin
    await supabase.from('admin_notifications').insert({
      type: 'inventory',
      location_id: selectedLocation.location_id,
      company_id: selectedLocation.locations.company_id,
      title: `Inwentaryzacja - ${selectedLocation.locations.name}`,
      message: `${selectedJob.type === 'MONTHLY' ? 'Miesięczna' : 'Tygodniowa'} inwentaryzacja wysłana przez ${closingPersonName}`,
      reference_id: selectedJob.id,
      status: 'unread',
      created_by: userId,
    })

    setInventorySaving(false)
    alert('✅ Inwentaryzacja wysłana do zatwierdzenia')
    setSelectedJob(null)
    setInventorySubView('active')
  }

  // ── Row helpers ──
  const addEmployeeRow = () => setEmployeeRows(p => [...p, { employee_id: '', hours: '' }])
  const removeEmployeeRow = (i: number) => setEmployeeRows(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p)
  const updateEmployeeRow = (i: number, f: 'employee_id' | 'hours', v: string) =>
    setEmployeeRows(p => { const c = [...p]; c[i] = { ...c[i], [f]: v }; return c })
  const addCosLine = () => setCosLineItems(p => [...p, { ...emptyLineItem }])
  const removeCosLine = (i: number) => setCosLineItems(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p)
  const updateCosLine = (i: number, f: keyof InvoiceLineItem, v: string) =>
    setCosLineItems(p => { const c = [...p]; c[i] = { ...c[i], [f]: v }; return c })

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  if (loading) return <div className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Ładowanie…</div>

  if (!selectedLocation) return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto flex flex-col justify-center">
      <h1 className="text-2xl font-bold mb-8 text-center text-slate-900">Wybierz lokalizację</h1>
      <div className="grid gap-4">
        {myLocations.map((item, i) => (
          <Button key={i} variant="outline" className="h-20 text-lg border-2" onClick={() => setSelectedLocation(item)}>📍 {item.locations.name}</Button>
        ))}
      </div>
      <Button variant="ghost" className="mt-8 text-slate-500" onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}>Wyloguj</Button>
    </div>
  )

  const kpiColor = laborPercent < 0.27 ? 'text-green-700' : laborPercent <= 0.3 ? 'text-yellow-700' : laborPercent <= 0.4 ? 'text-orange-600' : 'text-red-700'
  const cashDiffColor = Math.abs(cashDiff) < 0.01 ? 'text-green-700' : 'text-red-700'

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <OpsSidebar
        locationName={selectedLocation.locations.name}
        activeView={activeView}
        onNavigate={(v: string) => setActiveView(v as ActiveView)}
        onLogout={async () => { await supabase.auth.signOut(); router.push('/login') }}
        onSwitchLocation={() => setSelectedLocation(null)}
      />

      <main className="flex-1 ml-64 p-12">

        {/* ╔══════════════════════════════════════════════════════════╗ */}
        {/* ║  1. DAILY REPORTING                                      ║ */}
        {/* ╚══════════════════════════════════════════════════════════╝ */}
        {activeView === 'reporting' && (
          <div className="max-w-4xl">
            <header className="mb-8"><h1 className="text-3xl font-bold text-gray-900">Raport dzienny</h1></header>

            {validationErrors.length > 0 && (
              <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-6 h-6 text-red-600" />
                  <h3 className="font-bold text-red-800 text-lg">Nie można zapisać ({validationErrors.length} błędów)</h3></div>
                <ul className="space-y-1">{validationErrors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{e.message}</li>
                ))}</ul>
              </div>
            )}

            <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-8">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-slate-50 border border-slate-200 rounded p-4">
                <div className="space-y-1"><Label className="font-semibold">Data raportu</Label>
                  <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="bg-white h-10 w-48" /></div>
                <div className="text-right"><p className="text-xs text-slate-500 uppercase font-semibold">Osoba zamykająca</p>
                  <p className="text-sm font-medium text-slate-800">{closingPersonName}</p>
                  <p className="text-xs text-slate-400">{closingPersonEmail}</p></div>
              </div>

              {/* S1: Sprzedaż */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">1. Sprzedaż rzeczywista</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-6">
                <div className="space-y-2"><Label>Utarg brutto *{fieldErr('gross') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                  <div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input type="number" placeholder="0,00" value={salesForm.gross} onChange={e => setSalesForm({...salesForm, gross: e.target.value})}
                      disabled={isReadOnly} className={`bg-gray-50 h-12 text-lg pl-8 ${fieldErr('gross') ? 'border-red-400 ring-1 ring-red-300' : ''}`} /></div></div>
                <div className="space-y-2"><Label>Utarg netto <span className="text-xs text-slate-400 ml-1">{isNetManual ? '(ręcznie)' : '(auto)'}</span></Label>
                  <div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input type="number" placeholder={gross > 0 ? netCalculated.toFixed(2) : '0,00'} value={salesForm.netRevenue}
                      onChange={e => setSalesForm({...salesForm, netRevenue: e.target.value})} disabled={isReadOnly} className="bg-gray-50 h-12 text-lg pl-8" /></div>
                  {!isNetManual && gross > 0 && <p className="text-xs text-slate-400">Auto: {fmt2(netCalculated)}</p>}
                  {isNetManual && gross > 0 && Math.abs(netManual - netCalculated) > 1 && <p className="text-xs text-amber-600">⚠ Różnica: {fmt2(netManual - netCalculated)}</p>}</div>
                <div className="space-y-2"><Label>Transakcje *{fieldErr('transactions') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                  <Input type="number" placeholder="0" value={salesForm.transactions} onChange={e => setSalesForm({...salesForm, transactions: e.target.value})}
                    disabled={isReadOnly} className={`bg-gray-50 h-12 text-lg ${fieldErr('transactions') ? 'border-red-400 ring-1 ring-red-300' : ''}`} /></div>
                <div />
                <div className="space-y-2"><Label>Karty{fieldErr('card_cash') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                  <div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input type="number" placeholder="0,00" value={salesForm.card} onChange={e => setSalesForm({...salesForm, card: e.target.value})}
                      disabled={isReadOnly} className={`bg-gray-50 h-12 text-lg pl-8 ${fieldErr('card_cash') ? 'border-red-400' : ''}`} /></div></div>
                <div className="space-y-2"><Label>Gotówka{fieldErr('card_cash') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                  <div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span>
                    <Input type="number" placeholder="0,00" value={salesForm.cash} onChange={e => setSalesForm({...salesForm, cash: e.target.value})}
                      disabled={isReadOnly} className={`bg-gray-50 h-12 text-lg pl-8 ${fieldErr('card_cash') ? 'border-red-400' : ''}`} /></div></div>
              </div>

              {gross > 0 && Math.abs(card + cash - gross) > 0.5 && (
                <div className="mb-4 bg-yellow-50 border border-yellow-300 text-yellow-800 p-3 rounded flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4" />Karty + Gotówka = {fmt2(card + cash)} ≠ Brutto {fmt2(gross)}</div>
              )}

              <Card className="mb-8"><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-600">Podsumowanie sprzedaży</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-xs text-slate-500 uppercase">Netto</p><p className="text-xl font-bold">{fmt0(net)}</p>
                    {isNetManual && <p className="text-xs text-blue-600">📝 Ręczne</p>}</div>
                  <div><p className="text-xs text-slate-500 uppercase">Śr. paragon</p><p className="text-xl font-bold">{fmt2(aov)}</p>
                    <p className="text-xs text-slate-500">Tx: {tx}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase">Płatności</p>
                    <p className="text-xs text-slate-500">Karty: {gross > 0 ? fmtPct(cardPercent) : '—'}</p>
                    <p className="text-xs text-slate-500">Gotówka: {gross > 0 ? fmtPct(cashPercent) : '—'}</p></div>
                </CardContent></Card>

              {/* S2: Plan */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">2. Plan vs wykonanie</h3>
              <div className="grid grid-cols-2 gap-6 mb-4 bg-gray-50 p-6 rounded border border-gray-200">
                <div className="space-y-2"><Label>Plan brutto</Label><Input type="number" placeholder="0" value={salesForm.targetGross} onChange={e => setSalesForm({...salesForm, targetGross: e.target.value})} disabled={isReadOnly} className="bg-white" /></div>
                <div className="space-y-2"><Label>Plan transakcji</Label><Input type="number" placeholder="0" value={salesForm.targetTx} onChange={e => setSalesForm({...salesForm, targetTx: e.target.value})} disabled={isReadOnly} className="bg-white" /></div>
              </div>

              {isSalesBelow80 && (
                <div className={`mb-8 p-4 rounded border-2 ${fieldErr('salesDeviationExplanation') ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
                  <p className="font-bold text-amber-800 text-sm mb-2">⚠ Sprzedaż &lt; 80% planu ({fmtPct(planRealisation)}) — wyjaśnij *</p>
                  <textarea value={salesForm.salesDeviationExplanation} onChange={e => setSalesForm({...salesForm, salesDeviationExplanation: e.target.value})}
                    disabled={isReadOnly} placeholder="Przyczyna…" className="w-full min-h-[60px] rounded-md border border-input bg-white px-3 py-2 text-sm" /></div>
              )}

              {/* S3: Obsada */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">3. Obsada zmian{fieldErr('staff') && <span className="text-red-500 text-sm ml-2">⚠</span>}</h3>
              <div className={`grid grid-cols-3 gap-6 mb-8 p-6 rounded border ${fieldErr('staff') ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                {[['staffMorning', '🌅 Rano'], ['staffAfternoon', '☀️ Popołudnie'], ['staffEvening', '🌙 Wieczór']].map(([key, label]) => (
                  <div key={key} className="space-y-2"><Label>{label as string}</Label>
                    <Input type="number" min="0" placeholder="0" value={(salesForm as any)[key]}
                      onChange={e => setSalesForm({...salesForm, [key]: e.target.value})} disabled={isReadOnly} className="bg-white h-12 text-lg text-center" /></div>
                ))}
              </div>

              {/* S4: Godziny */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">4. Godziny pracowników{fieldErr('hours') && <span className="text-red-500 text-sm ml-2">⚠</span>}</h3>
              <Card className={`mb-6 ${fieldErr('hours') ? 'border-red-300' : ''}`}>
                <CardContent className="space-y-3 pt-4">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 border-b pb-2">
                    <div className="col-span-5">Pracownik</div><div className="col-span-2 text-right">Godziny</div>
                    <div className="col-span-2 text-right">Stawka</div><div className="col-span-2 text-right">Koszt</div><div className="col-span-1" /></div>
                  {employeeRows.map((row, i) => {
                    const emp = employees.find(e => e.id === row.employee_id)
                    const h = Number(row.hours) || 0; const rate = emp?.real_hour_cost || 0
                    return (<div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-5"><select value={row.employee_id} onChange={e => updateEmployeeRow(i, 'employee_id', e.target.value)}
                        disabled={isReadOnly} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                        <option value="">– wybierz –</option>{employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
                      <div className="col-span-2"><Input type="number" value={row.hours} onChange={e => updateEmployeeRow(i, 'hours', e.target.value)} disabled={isReadOnly} className="h-9 text-right" /></div>
                      <div className="col-span-2 text-right text-slate-500">{rate ? fmt2(rate) : '—'}</div>
                      <div className="col-span-2 text-right font-medium">{h * rate > 0 ? fmt2(h * rate) : '—'}</div>
                      <div className="col-span-1 flex justify-end">{!isReadOnly && <Button variant="ghost" size="icon" onClick={() => removeEmployeeRow(i)} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>}</div>
                    </div>)})}
                  {!isReadOnly && <Button variant="outline" size="sm" onClick={addEmployeeRow} className="mt-2"><Plus className="w-4 h-4 mr-1" />Dodaj</Button>}
                  <div className="border-t pt-3 text-xs text-slate-500 flex justify-between">
                    <span>Suma: <b>{totalHours.toFixed(1)} h</b></span><span>Koszt: <b>{fmt2(laborCost)}</b></span><span>Śr: <b>{fmt2(effectiveHourlyRate)}</b></span></div>
                </CardContent></Card>

              {isLaborAboveThreshold && (
                <div className={`mb-8 p-4 rounded border-2 ${fieldErr('laborExplanation') ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
                  <p className="font-bold text-red-800 text-sm mb-2">⚠ Koszt pracy &gt; 40% ({fmtPct(laborPercent)}) — wyjaśnij *</p>
                  <textarea value={salesForm.laborExplanation} onChange={e => setSalesForm({...salesForm, laborExplanation: e.target.value})}
                    disabled={isReadOnly} placeholder="Przyczyna…" className="w-full min-h-[60px] rounded-md border border-input bg-white px-3 py-2 text-sm" /></div>
              )}

              {/* S5: KPI */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">5. KPI dnia</h3>
              <Card className="mb-8"><CardContent className="grid grid-cols-3 gap-4 text-sm pt-6">
                <div><p className="text-xs text-slate-500 uppercase">Netto</p><p className="text-lg font-bold">{fmt0(net)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Plan %</p><p className={`text-lg font-bold ${isSalesBelow80 ? 'text-red-700' : ''}`}>{planNet > 0 ? fmtPct(planRealisation) : '—'}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Paragon</p><p className="text-lg font-bold">{fmt2(aov)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Praca %</p><p className={`text-lg font-bold ${kpiColor}`}>{net > 0 ? fmtPct(laborPercent) : '—'}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Netto/h</p><p className="text-lg font-bold">{fmt2(salesPerHour)}</p></div>
                <div><p className="text-xs text-slate-500 uppercase">Obsada</p><p className="text-lg font-bold">{totalStaff} <span className="text-xs font-normal text-slate-500">({staffMorning}/{staffAfternoon}/{staffEvening})</span></p></div>
              </CardContent></Card>

              {/* S6: Gotówka */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">6. Kontrola gotówki</h3>
              <Card className="mb-4"><CardContent className="grid grid-cols-3 gap-4 pt-4 text-sm">
                <div className="space-y-2"><Label>Raport kasowy</Label><Input type="number" value={salesForm.cashReported} onChange={e => setSalesForm({...salesForm, cashReported: e.target.value})} disabled={isReadOnly} className="bg-gray-50" /></div>
                <div className="space-y-2"><Label>Stan fizyczny</Label><Input type="number" value={salesForm.cashPhysical} onChange={e => setSalesForm({...salesForm, cashPhysical: e.target.value})} disabled={isReadOnly} className="bg-gray-50" /></div>
                <div className="space-y-2"><Label>Różnica</Label><p className={`h-10 flex items-center font-bold ${cashDiffColor}`}>{fmt2(cashDiff)} {cashDiff === 0 ? '(OK)' : cashDiff > 0 ? '– nadw.' : '– niedob.'}</p></div>
              </CardContent></Card>

              {(Math.abs(cashDiff) > 0.01) && (
                <div className={`mb-8 p-4 rounded border-2 ${fieldErr('cashDiffExplanation') ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
                  <p className={`font-bold text-sm mb-2 ${isCashDiffAbove20 ? 'text-red-800' : 'text-amber-800'}`}>⚠ Różnica: {fmt2(cashDiff)} — wyjaśnij *</p>
                  <textarea value={salesForm.cashDiffExplanation} onChange={e => setSalesForm({...salesForm, cashDiffExplanation: e.target.value})}
                    disabled={isReadOnly} placeholder="Przyczyna…" className="w-full min-h-[60px] rounded-md border border-input bg-white px-3 py-2 text-sm" /></div>
              )}

              {/* S7: Koszty ops */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">7. Koszty operacyjne</h3>
              <Card className="mb-8"><CardContent className="grid grid-cols-4 gap-4 pt-4 text-sm">
                {[['pettyExpense', 'Wydatki drobne'], ['losses', 'Straty'], ['refunds', 'Zwroty']].map(([k, l]) => (
                  <div key={k} className="space-y-2"><Label>{l as string}</Label><Input type="number" placeholder="0" value={(salesForm as any)[k]}
                    onChange={e => setSalesForm({...salesForm, [k]: e.target.value})} disabled={isReadOnly} className="bg-gray-50" /></div>
                ))}<div className="space-y-2"><Label>Suma</Label><p className="h-10 flex items-center font-bold">{fmt2(dailyOpsTotal)}</p></div>
              </CardContent></Card>

              {/* S8: Zdarzenia */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">8. Zdarzenia dnia</h3>
              <Card className="mb-8"><CardContent className="space-y-4 pt-4 text-sm">
                <select value={salesForm.incidentType} onChange={e => setSalesForm({...salesForm, incidentType: e.target.value})} disabled={isReadOnly}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">– brak –</option><option value="problem_operacyjny">Problem operacyjny</option>
                  <option value="awaria">Awaria</option><option value="braki_kadrowe">Braki kadrowe</option>
                  <option value="reklamacje">Reklamacje</option><option value="inne">Inne</option></select>
                <textarea value={salesForm.incidentDetails} onChange={e => setSalesForm({...salesForm, incidentDetails: e.target.value})}
                  disabled={isReadOnly} placeholder="Opis…" className="w-full min-h-[60px] rounded-md border border-input bg-gray-50 px-3 py-2 text-sm" />
              </CardContent></Card>

              {/* S9: Komentarz */}
              <h3 className="font-bold text-lg text-gray-900 mb-4 border-b pb-2">9. Komentarz</h3>
              <textarea value={salesForm.comments} onChange={e => setSalesForm({...salesForm, comments: e.target.value})}
                disabled={isReadOnly} placeholder="Uwagi (opcjonalnie)…" className="w-full min-h-[60px] rounded-md border border-input bg-gray-50 px-3 py-2 text-sm mb-8" />

              {!isReadOnly && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Zamykający: {closingPersonName}</p>
                  <Button onClick={handleReportSubmit} className="bg-black text-white hover:bg-gray-800 h-14 px-8 text-lg font-bold"><Send className="w-4 h-4 mr-2" />Wyślij raport</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ╔══════════════════════════════════════════════════════════╗ */}
        {/* ║  2. INVOICES & COSTS                                     ║ */}
        {/* ╚══════════════════════════════════════════════════════════╝ */}
        {activeView === 'invoices' && (
          <div className="max-w-5xl">
            <header className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Faktury i koszty</h1>
              <div className="flex gap-2 mt-4">
                <Button variant={invoiceSubView === 'form' ? 'default' : 'outline'} onClick={() => setInvoiceSubView('form')}>
                  <FileText className="w-4 h-4 mr-2" />Nowa faktura</Button>
                <Button variant={invoiceSubView === 'semis_recon' ? 'default' : 'outline'} onClick={() => setInvoiceSubView('semis_recon')}>
                  <RefreshCw className="w-4 h-4 mr-2" />Uzgodnienie SEMIS</Button>
              </div>
            </header>

            {/* ── Invoice Form ── */}
            {invoiceSubView === 'form' && (
              <>
                {invoiceErrors.length > 0 && (
                  <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-6 h-6 text-red-600" /><h3 className="font-bold text-red-800">Nie można zapisać</h3></div>
                    <ul className="space-y-1">{invoiceErrors.map((e, i) => <li key={i} className="flex items-start gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5" />{e.message}</li>)}</ul>
                  </div>
                )}

                {/* Type selection */}
                <Card className={`mb-6 ${invErr('invoiceType') ? 'border-red-400' : ''}`}>
                  <CardHeader><CardTitle>Krok 1 — Typ faktury</CardTitle></CardHeader>
                  <CardContent><div className="grid grid-cols-2 gap-4">
                    {[{ t: 'COS' as const, icon: Package, label: 'Zakup magazynowy (COS)', desc: 'Rozbijana na pozycje — COGS, stany', color: 'blue' },
                      { t: 'SEMIS' as const, icon: Receipt, label: 'Koszt operacyjny (SEMIS)', desc: 'Zbiorczo — czynsz, media, marketing', color: 'emerald' }
                    ].map(({ t, icon: Icon, label, desc, color }) => (
                      <button key={t} onClick={() => { setInvoiceType(t); setInvoiceErrors([]) }}
                        className={`p-6 rounded-lg border-2 text-left transition-all ${invoiceType === t ? `border-${color}-600 bg-${color}-50 ring-2 ring-${color}-200` : 'border-gray-200 hover:border-gray-400'}`}>
                        <div className="flex items-center gap-3 mb-2"><Icon className={`w-6 h-6 ${invoiceType === t ? `text-${color}-600` : 'text-gray-400'}`} />
                          <span className="font-bold text-lg">{label}</span></div>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </button>
                    ))}</div></CardContent></Card>

                {invoiceType && (
                  <>
                    {/* Common fields */}
                    <Card className="mb-6"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Krok 2 — Dane faktury
                      <span className={`ml-2 text-xs px-2 py-1 rounded-full font-semibold ${invoiceType === 'COS' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {invoiceType === 'COS' ? '📦 Magazynowa' : '💼 Kosztowa'}</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2"><Label>Dostawca *{invErr('supplier') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                            <Input placeholder="np. Hurtownia" value={invoiceCommon.supplier} onChange={e => setInvoiceCommon({...invoiceCommon, supplier: e.target.value})} className={invErr('supplier') ? 'border-red-400' : ''} /></div>
                          <div className="space-y-2"><Label>Numer faktury *{invErr('invoiceNumber') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                            <Input placeholder="FV/2025/001" value={invoiceCommon.invoiceNumber} onChange={e => setInvoiceCommon({...invoiceCommon, invoiceNumber: e.target.value})} className={invErr('invoiceNumber') ? 'border-red-400' : ''} /></div>
                          <div className="space-y-2"><Label>Data sprzedaży *</Label><Input type="date" value={invoiceCommon.saleDate} onChange={e => setInvoiceCommon({...invoiceCommon, saleDate: e.target.value})} /></div>
                          <div className="space-y-2"><Label>Data wpływu</Label><Input type="date" value={invoiceCommon.receiptDate} onChange={e => setInvoiceCommon({...invoiceCommon, receiptDate: e.target.value})} /></div>
                        </div>
                        <div className={`mt-6 border-2 border-dashed p-4 rounded ${invoiceType === 'COS' && invErr('file') ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
                          <Label className="mb-2 block font-semibold">{invoiceType === 'COS' ? 'Załącznik (obowiązkowy) *' : 'Załącznik (opcjonalnie)'}</Label>
                          <Input type="file" accept="image/*,application/pdf" onChange={e => setInvoiceFile(e.target.files?.[0] || null)} />
                          {invoiceFile && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{invoiceFile.name}</p>}
                        </div>
                        <div className="mt-4 bg-slate-50 rounded p-3 text-sm text-slate-600">💳 Płatność: <b>Przelew</b> (auto)</div>
                      </CardContent></Card>

                    {/* COS Line Items */}
                    {invoiceType === 'COS' && (
                      <Card className={`mb-6 ${invErr('lineItems') ? 'border-red-400' : ''}`}>
                        <CardHeader><CardTitle>Krok 3 — Pozycje (COS)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 border-b pb-2">
                            <div className="col-span-2">Produkt</div><div className="col-span-2">Kategoria</div>
                            <div className="col-span-1 text-right">Ilość</div><div className="col-span-1">Jedn.</div>
                            <div className="col-span-1 text-right">Cena</div><div className="col-span-2 text-right">Netto</div>
                            <div className="col-span-1">VAT</div><div className="col-span-1 text-right">Brutto</div><div className="col-span-1" /></div>
                          {cosLineItems.map((item, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
                              <div className="col-span-2"><Input placeholder="Produkt" value={item.product} onChange={e => updateCosLine(i, 'product', e.target.value)} className="h-9" /></div>
                              <div className="col-span-2"><select value={item.cosCategory} onChange={e => updateCosLine(i, 'cosCategory', e.target.value)}
                                className={`h-9 w-full rounded-md border ${item.product && !item.cosCategory ? 'border-red-300' : 'border-input'} bg-background px-1 text-xs`}>
                                <option value="">–</option>{COS_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                              <div className="col-span-1"><Input type="number" value={item.quantity} onChange={e => updateCosLine(i, 'quantity', e.target.value)} className="h-9 text-right" /></div>
                              <div className="col-span-1"><select value={item.unit} onChange={e => updateCosLine(i, 'unit', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs">
                                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div>
                              <div className="col-span-1"><Input type="number" value={item.netPrice} onChange={e => updateCosLine(i, 'netPrice', e.target.value)} className="h-9 text-right" /></div>
                              <div className="col-span-2 text-right text-slate-700 font-medium">{getLineNet(item) > 0 ? fmt2(getLineNet(item)) : '—'}</div>
                              <div className="col-span-1"><select value={item.vatRate} onChange={e => updateCosLine(i, 'vatRate', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs">
                                {VAT_RATES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                              <div className="col-span-1 text-right font-medium">{getLineGross(item) > 0 ? fmt2(getLineGross(item)) : '—'}</div>
                              <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => removeCosLine(i)} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button></div>
                            </div>))}
                          <Button variant="outline" size="sm" onClick={addCosLine}><Plus className="w-4 h-4 mr-1" />Dodaj pozycję</Button>
                          <div className="border-t-2 pt-4 mt-4 grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded p-3"><p className="text-xs text-slate-500 uppercase">Netto</p><p className="text-xl font-bold">{fmt2(cosTotalNet)}</p></div>
                            <div className="bg-slate-50 rounded p-3"><p className="text-xs text-slate-500 uppercase">VAT</p><p className="text-xl font-bold">{fmt2(cosTotalVat)}</p></div>
                            <div className="bg-blue-50 rounded p-3 border border-blue-200"><p className="text-xs text-blue-600 uppercase font-semibold">Brutto</p><p className="text-xl font-bold text-blue-800">{fmt2(cosTotalGross)}</p></div>
                          </div>
                        </CardContent></Card>
                    )}

                    {/* SEMIS Form */}
                    {invoiceType === 'SEMIS' && (
                      <Card className="mb-6"><CardHeader><CardTitle>Krok 3 — Koszt (SEMIS)</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><Label>Kwota netto *{invErr('semisAmount') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                              <div className="relative"><span className="absolute left-3 top-3 text-gray-400">zł</span>
                                <Input type="number" placeholder="0,00" value={semisForm.totalNet} onChange={e => setSemisForm({...semisForm, totalNet: e.target.value})} className={`pl-8 h-12 text-lg ${invErr('semisAmount') ? 'border-red-400' : ''}`} /></div></div>
                            <div className="space-y-2"><Label>VAT</Label>
                              <select value={semisForm.vatRate} onChange={e => setSemisForm({...semisForm, vatRate: e.target.value})} className="h-12 w-full rounded-md border border-input bg-background px-3">
                                {VAT_RATES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
                          </div>
                          <div className="space-y-2"><Label>Kategoria *{invErr('semisCategory') && <span className="text-red-500 text-xs ml-1">⚠</span>}</Label>
                            <select value={semisForm.category} onChange={e => setSemisForm({...semisForm, category: e.target.value})}
                              className={`h-10 w-full rounded-md border ${invErr('semisCategory') ? 'border-red-400' : 'border-input'} bg-background px-3 text-sm`}>
                              <option value="">– wybierz –</option>{SEMIS_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                          <textarea value={semisForm.description} onChange={e => setSemisForm({...semisForm, description: e.target.value})}
                            placeholder="Opis…" className="w-full min-h-[60px] rounded-md border border-input bg-gray-50 px-3 py-2 text-sm" />
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded p-3"><p className="text-xs text-slate-500 uppercase">Netto</p><p className="text-xl font-bold">{fmt2(semisTotalNet)}</p></div>
                            <div className="bg-slate-50 rounded p-3"><p className="text-xs text-slate-500 uppercase">VAT</p><p className="text-xl font-bold">{fmt2(semisTotalGross - semisTotalNet)}</p></div>
                            <div className="bg-emerald-50 rounded p-3 border border-emerald-200"><p className="text-xs text-emerald-600 uppercase font-semibold">Brutto</p><p className="text-xl font-bold text-emerald-800">{fmt2(semisTotalGross)}</p></div>
                          </div>
                        </CardContent></Card>
                    )}

                    <div className="flex justify-end mb-8">
                      <Button onClick={handleInvoiceSubmit} disabled={uploading}
                        className={`h-14 px-8 text-lg font-bold text-white ${invoiceType === 'COS' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        <Send className="w-4 h-4 mr-2" />{uploading ? 'Zapisywanie…' : 'Wyślij fakturę'}</Button>
                    </div>
                  </>
                )}

                {/* Excel import */}
                <Card className="bg-green-50 border-green-200"><CardHeader><CardTitle className="text-green-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Import z Excela</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-green-700">Kolumny: <b>Data sprzedaży</b>, <b>Sprzedawca</b>, <b>RK</b>, <b>PLN Netto</b></p>
                    <div className="bg-white p-6 rounded border border-green-200 text-center"><Input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} disabled={excelLoading} /></div>
                    {excelLoading ? <p className="text-center font-bold text-green-800 animate-pulse">Przetwarzanie…</p>
                      : <div className="flex items-center justify-center gap-2 text-green-700 text-sm"><CheckCircle className="w-4 h-4" />Gotowe</div>}
                  </CardContent></Card>
              </>
            )}

            {/* ── SEMIS Reconciliation Entry (Ops data entry) ── */}
            {invoiceSubView === 'semis_recon' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5" />Uzgodnienie SEMIS — wprowadzanie danych
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-500 mb-6">
                      Wprowadź dane z faktury do uzgodnienia z księgowością. Po wprowadzeniu wszystkich pozycji, wyślij do zatwierdzenia.
                    </p>

                    {/* Entry form */}
                    <div className="bg-slate-50 rounded-lg p-6 mb-6">
                      <h4 className="font-semibold mb-4">Nowa pozycja</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Nr faktury *</Label>
                          <Input 
                            placeholder="FV/2025/001" 
                            value={newSemisEntry.invoice_number}
                            onChange={e => setNewSemisEntry({...newSemisEntry, invoice_number: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dostawca</Label>
                          <Input 
                            placeholder="Nazwa dostawcy"
                            value={newSemisEntry.supplier}
                            onChange={e => setNewSemisEntry({...newSemisEntry, supplier: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Data faktury</Label>
                          <Input 
                            type="date"
                            value={newSemisEntry.invoice_date}
                            onChange={e => setNewSemisEntry({...newSemisEntry, invoice_date: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Konto księgowe</Label>
                          <select 
                            value={newSemisEntry.accounting_account}
                            onChange={e => setNewSemisEntry({...newSemisEntry, accounting_account: e.target.value})}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">– wybierz –</option>
                            {ACCOUNTING_ACCOUNTS.map(a => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Kwota netto *</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400">zł</span>
                            <Input 
                              type="number" 
                              placeholder="0,00"
                              value={newSemisEntry.amount}
                              onChange={e => setNewSemisEntry({...newSemisEntry, amount: e.target.value})}
                              className="pl-8"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Opis</Label>
                          <Input 
                            placeholder="Opcjonalny opis"
                            value={newSemisEntry.description}
                            onChange={e => setNewSemisEntry({...newSemisEntry, description: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button onClick={handleAddSemisReconEntry} disabled={semisReconSaving}>
                          <Plus className="w-4 h-4 mr-2" />Dodaj pozycję
                        </Button>
                      </div>
                    </div>

                    {/* Pending entries list */}
                    {semisReconEntries.length > 0 ? (
                      <>
                        <h4 className="font-semibold mb-3">Pozycje do wysłania ({semisReconEntries.length})</h4>
                        <div className="border rounded-lg overflow-hidden mb-4">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="border-b text-left text-xs text-slate-500 uppercase">
                                <th className="py-2 px-3">Nr faktury</th>
                                <th className="px-3">Dostawca</th>
                                <th className="px-3">Data</th>
                                <th className="px-3">Konto</th>
                                <th className="px-3 text-right">Kwota</th>
                                <th className="px-3"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {semisReconEntries.map((entry) => (
                                <tr key={entry.id} className="border-b hover:bg-gray-50">
                                  <td className="py-2 px-3 font-medium">{entry.invoice_number}</td>
                                  <td className="px-3">{entry.supplier || '—'}</td>
                                  <td className="px-3 text-slate-500">{entry.invoice_date}</td>
                                  <td className="px-3 text-slate-500">{entry.accounting_account || '—'}</td>
                                  <td className="px-3 text-right font-medium">{fmt2(Number(entry.amount) || 0)}</td>
                                  <td className="px-3">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => entry.id && handleDeleteSemisEntry(entry.id)}
                                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-800 font-medium">Suma: {fmt2(semisReconEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</p>
                            <p className="text-xs text-blue-600">{semisReconEntries.length} pozycji do weryfikacji</p>
                          </div>
                          <Button 
                            onClick={handleSubmitSemisReconBatch}
                            disabled={semisReconSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {semisReconSaving ? 'Wysyłanie...' : 'Wyślij do zatwierdzenia'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Brak pozycji do wysłania</p>
                        <p className="text-sm mt-1">Dodaj pozycje używając formularza powyżej</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ╔══════════════════════════════════════════════════════════╗ */}
        {/* ║  3. INVENTORY                                            ║ */}
        {/* ╚══════════════════════════════════════════════════════════╝ */}
        {activeView === 'inventory' && (
          <div className="max-w-5xl">
            <header className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ClipboardList className="w-8 h-8" />Inwentaryzacja
              </h1>
              {inventorySubView !== 'fill' && (
                <div className="flex gap-2 mt-4">
                  <Button variant={inventorySubView === 'active' ? 'default' : 'outline'} onClick={() => setInventorySubView('active')}>Aktywne</Button>
                  <Button variant={inventorySubView === 'history' ? 'default' : 'outline'} onClick={() => setInventorySubView('history')}>Historia</Button>
                </div>
              )}
            </header>

            {/* ── Active Jobs ── */}
            {inventorySubView === 'active' && (
              <div className="space-y-4">
                {inventoryJobs.length === 0 ? (
                  <Card><CardContent className="py-12 text-center">
                    <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Brak aktywnych inwentaryzacji do wykonania</p>
                    <p className="text-sm text-slate-400 mt-1">Inwentaryzacje zlecane są przez administratora</p>
                  </CardContent></Card>
                ) : (
                  inventoryJobs.map(job => (
                    <Card key={job.id} className={`hover:shadow-md transition-shadow cursor-pointer ${job.status === 'correction' ? 'border-red-300 bg-red-50' : ''}`}
                      onClick={() => openJob(job)}>
                      <CardContent className="flex items-center justify-between py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${job.type === 'MONTHLY' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                            {job.type === 'MONTHLY' ? <Calendar className="w-6 h-6 text-blue-600" /> : <ClipboardList className="w-6 h-6 text-amber-600" />}
                          </div>
                          <div>
                            <p className="font-bold text-lg">{job.type === 'MONTHLY' ? 'Miesięczna — Pełna' : 'Tygodniowa — Zlecona'}</p>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Termin: {job.due_date}</span>
                              <span>{job.item_count} pozycji</span>
                            </div>
                            {job.note && <p className="text-sm text-slate-600 mt-1 italic">„{job.note}"</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_LABELS[job.status]?.color || 'bg-gray-100'}`}>
                            {STATUS_LABELS[job.status]?.label || job.status}</span>
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* ── Fill Form ── */}
            {inventorySubView === 'fill' && selectedJob && (
              <div className="space-y-6">
                <Button variant="ghost" onClick={() => { setInventorySubView('active'); setSelectedJob(null) }} className="mb-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />Powrót</Button>

                {/* Job header */}
                <Card><CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{selectedJob.type === 'MONTHLY' ? '📋 Inwentaryzacja miesięczna' : '📋 Inwentaryzacja tygodniowa'}</p>
                      <p className="text-sm text-slate-500">Termin: {selectedJob.due_date} • {jobItems.length} pozycji</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_LABELS[selectedJob.status]?.color}`}>
                      {STATUS_LABELS[selectedJob.status]?.label}</span>
                  </div>
                </CardContent></Card>

                {selectedJob.status === 'correction' && selectedJob.note && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-sm text-red-800">
                    <p className="font-bold mb-1">⚠ Komentarz admina (korekta):</p>
                    <p>{selectedJob.note}</p>
                  </div>
                )}

                {/* Search + filter */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input placeholder="Szukaj produktu…" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} className="pl-10" />
                  </div>
                  <select value={inventoryCategoryFilter} onChange={e => setInventoryCategoryFilter(e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Wszystkie kategorie</option>
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Items table */}
                <Card><CardContent className="pt-4">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 border-b pb-2 mb-2">
                    <div className="col-span-3">Produkt</div><div className="col-span-1">Kategoria</div>
                    <div className="col-span-1">Jedn.</div><div className="col-span-2 text-right">Oczekiwany</div>
                    <div className="col-span-2 text-right">Policzony</div><div className="col-span-3">Uwagi</div>
                  </div>
                  {filteredJobItems.length === 0 ? (
                    <p className="text-center py-4 text-slate-400">Brak pozycji pasujących do filtrów</p>
                  ) : (
                    filteredJobItems.map(item => {
                      const counted = Number(item.counted_qty) || 0
                      const expected = item.expected_qty || 0
                      const diff = counted - expected
                      const hasDiff = item.counted_qty !== '' && expected > 0 && Math.abs(diff) > 0.01
                      return (
                        <div key={item.id} className={`grid grid-cols-12 gap-2 items-center text-sm py-2 border-b border-gray-100 ${hasDiff ? 'bg-amber-50' : ''}`}>
                          <div className="col-span-3 font-medium">{item.product_name}</div>
                          <div className="col-span-1 text-xs text-slate-500">{item.category}</div>
                          <div className="col-span-1 text-xs text-slate-500">{item.unit}</div>
                          <div className="col-span-2 text-right text-slate-500">{expected > 0 ? expected : '—'}</div>
                          <div className="col-span-2">
                            <Input type="number" value={item.counted_qty} onChange={e => updateJobItem(item.id, 'counted_qty', e.target.value)}
                              disabled={selectedJob.status === 'submitted' || selectedJob.status === 'approved'}
                              className={`h-9 text-right ${hasDiff ? 'border-amber-400' : ''}`} />
                          </div>
                          <div className="col-span-3">
                            <Input value={item.note} onChange={e => updateJobItem(item.id, 'note', e.target.value)}
                              disabled={selectedJob.status === 'submitted' || selectedJob.status === 'approved'}
                              placeholder="Uwagi…" className="h-9 text-xs" />
                          </div>
                        </div>
                      )
                    })
                  )}

                  <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Wyświetlane: {filteredJobItems.length} / {jobItems.length} pozycji</span>
                    <span>Uzupełnione: {jobItems.filter(i => i.counted_qty !== '').length} / {jobItems.length}</span>
                  </div>
                </CardContent></Card>

                {/* Actions */}
                {(selectedJob.status === 'draft' || selectedJob.status === 'correction') && (
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={saveInventoryDraft} disabled={inventorySaving}>
                      {inventorySaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Zapisz roboczo</Button>
                    <Button onClick={submitInventory} disabled={inventorySaving} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-6 text-lg font-bold">
                      <Send className="w-4 h-4 mr-2" />Wyślij do zatwierdzenia</Button>
                  </div>
                )}
              </div>
            )}

            {/* ── History ── */}
            {inventorySubView === 'history' && (
              <div className="space-y-4">
                {inventoryHistory.length === 0 ? (
                  <Card><CardContent className="py-12 text-center"><p className="text-slate-400">Brak historii</p></CardContent></Card>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left text-xs text-slate-500 uppercase">
                        <th className="py-2 pr-2">Data</th><th className="pr-2">Typ</th><th className="pr-2">Status</th>
                        <th className="pr-2">Pozycje</th><th className="pr-2">Wysłana przez</th>
                      </tr></thead>
                      <tbody>{inventoryHistory.map(job => (
                        <tr key={job.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 pr-2">{job.due_date}</td>
                          <td className="pr-2">{job.type === 'MONTHLY' ? '📅 Miesięczna' : '📋 Tygodniowa'}</td>
                          <td className="pr-2"><span className={`text-xs px-2 py-1 rounded-full ${STATUS_LABELS[job.status]?.color}`}>
                            {STATUS_LABELS[job.status]?.label}</span></td>
                          <td className="pr-2">{job.item_count}</td>
                          <td className="pr-2 text-slate-500">{job.submitted_by || '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}