'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '../supabase-client'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Calendar, Filter, MapPin, AlertTriangle, CheckCircle, Plus, Trash2,
  Save, Search, Eye, Send, ArrowLeft, Package, ClipboardList, BarChart3,
  Lock, RefreshCw, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  AlertOctagon, HelpCircle, ChevronRight, Edit2, ToggleLeft, ToggleRight,
  Clock, TrendingUp, AlertCircle, FileText, Receipt, Download, Bell,
  Users, Building2, DollarSign, TrendingDown, Minus, ThumbsUp, ThumbsDown,
  MessageSquare, ExternalLink, ImageIcon
} from 'lucide-react'
import * as XLSX from 'xlsx'        

/* ================================================================== */
/*  CONSTANTS                                                          */
/* ================================================================== */
const VAT_RATE = 0.08
const LABOR_PLAN_PERCENT = 0.25
const LABOR_GREEN_MAX = 0.27
const LABOR_YELLOW_MAX = 0.30
const GROSS_MARGIN_PLAN_PERCENT = 0.63

/* ================================================================== */
/*  TYPES                                                              */
/* ================================================================== */
type LocationRow = { id: string; name: string; company_id?: string }

type AdminNotification = {
  id: string
  type: 'daily_report' | 'invoice' | 'inventory' | 'semis_reconciliation'
  location_id: string
  company_id: string
  title: string
  message: string
  reference_id: string | null
  status: 'unread' | 'read' | 'actioned'
  created_at: string
  created_by: string
  location_name?: string
}

type DailyReport = {
  id: string
  location_id: string
  date: string
  gross_revenue: number
  net_revenue: number
  transaction_count: number
  card_payments: number
  cash_payments: number
  total_labor_hours: number
  avg_hourly_rate: number
  cash_diff: number
  petty_expenses: number
  daily_losses: number
  daily_refunds: number
  status: string
  closing_person: string
  comments: string
  labor_explanation: string
  sales_deviation_explanation: string
  cash_diff_explanation: string
  staff_morning: number
  staff_afternoon: number
  staff_evening: number
  incident_type: string
  incident_details: string
  location_name?: string
}

type Invoice = {
  id: string
  location_id: string
  supplier_name: string
  invoice_number: string
  invoice_type: string
  service_date: string
  total_amount: number
  total_net: number
  status: string
  attachment_url?: string
  locations?: { name: string }
}

type InventoryProduct = {
  id: string; name: string; unit: string; category: string
  is_food: boolean; active: boolean; last_price: number
}

type InventoryJob = {
  id: string; location_id: string; type: 'MONTHLY' | 'WEEKLY'
  status: 'draft' | 'submitted' | 'approved' | 'correction' | 'pending' | 'rejected'
  due_date: string; note: string; created_by: string; created_at: string
  submitted_at?: string; submitted_by?: string
  approved_at?: string; approved_by?: string
  location_name?: string; item_count?: number
}

type InventoryJobItem = {
  id: string; job_id: string; product_id: string
  product_name: string; unit: string; category: string
  expected_qty: number | null; counted_qty: number | null
  note: string; last_price: number | null
}

type SemisReconEntry = {
  id: string
  location_id: string
  invoice_number: string
  supplier: string
  invoice_date: string
  accounting_account: string
  amount: number
  description: string
  status: 'pending' | 'submitted' | 'verified' | 'rejected'
  submitted_at: string
  verified_by?: string
  verified_at?: string
  verification_note?: string
  location_name?: string
}

type ClosedMonth = {
  id: string; location_id: string; month: string; year: number
  closed_at: string; closed_by: string; location_name?: string
}

type ActiveView =
  | 'dashboard' | 'pnl' | 'notifications'
  | 'daily_reports' | 'daily_report_detail'
  | 'approvals' | 'inv_approvals' | 'inv_review'
  | 'semis_verification'
  | 'products' | 'monthly' | 'weekly'
  | 'monthclose'
  | 'reports' | 'history' | 'imported'

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */
const fmt0 = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(n || 0)
const fmt2 = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(n || 0)
const fmtPct = (v: number) => (v * 100).toFixed(1).replace('.', ',') + '%'

const PRODUCT_CATEGORIES = ['kawa', 'herbata', 'napoje', 'nabial', 'pieczywo', 'mieso', 'warzywa', 'owoce', 'suche', 'opakowania', 'dodatki', 'inne']
const UNITS = [{ value: 'kg', label: 'kg' }, { value: 'szt', label: 'szt.' }, { value: 'l', label: 'l' }, { value: 'opak', label: 'opak.' }, { value: 'but', label: 'but.' }, { value: 'kart', label: 'kart.' }]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Robocza', color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Wysłana', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Zatwierdzona', color: 'bg-green-100 text-green-700' },
  correction: { label: 'Do korekty', color: 'bg-red-100 text-red-700' },
  pending: { label: 'Oczekująca', color: 'bg-amber-100 text-amber-700' },
  verified: { label: 'Zweryfikowana', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Odrzucona', color: 'bg-red-100 text-red-700' },
}

const NOTIFICATION_ICONS: Record<string, any> = {
  daily_report: FileText,
  invoice: Receipt,
  inventory: ClipboardList,
  semis_reconciliation: RefreshCw,
}

const SEMIS_CATEGORIES: Record<string, string> = {
  'czynsz': 'Czynsz',
  'media': 'Media',
  'marketing': 'Marketing',
  'serwis_naprawy': 'Serwis',
  'ubezpieczenia': 'Ubezpieczenia',
  'it_software': 'IT/Software',
  'transport': 'Transport',
  'czystosc_higiena': 'Czystość',
  'administracja': 'Administracja',
  'inne_semis': 'Inne',
}

/* ================================================================== */
/*  COMPONENT                                                          */
/* ================================================================== */
export default function AdminDashboard() {
  const supabase = createClient()
  const router = useRouter()

  // ── Core ──
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [filterLocationId, setFilterLocationId] = useState<'all' | string>('all')
  const [adminName, setAdminName] = useState('')
  const [adminId, setAdminId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')

  // ── Notifications ──
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // ── Daily Reports ──
  const [pendingDailyReports, setPendingDailyReports] = useState<DailyReport[]>([])
  const [selectedDailyReport, setSelectedDailyReport] = useState<DailyReport | null>(null)
  const [dailyReportEmployeeHours, setDailyReportEmployeeHours] = useState<any[]>([])

  // ── PnL ──
  const [pnl, setPnl] = useState({
    netSales: 0, grossSales: 0, vatValue: 0, planNet: 0, planGross: 0,
    transactions: 0, planTransactions: 0, aov: 0, salesPerHour: 0,
    laborCost: 0, laborPercent: 0, totalHours: 0, effectiveHourlyRate: 0,
    cogs: 0, cogsPercent: 0, opex: 0, totalCosts: 0,
    grossMarginValue: 0, grossMarginPercent: 0, operatingProfit: 0, netMargin: 0,
    cashDiffTotal: 0, pettySum: 0, lossesSum: 0, refundsSum: 0,
  })
  const [alerts, setAlerts] = useState<string[]>([])
  const [statusText, setStatusText] = useState('')

  // ── Invoices ──
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([])
  const [importedCosts, setImportedCosts] = useState<any[]>([])
  const [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([])
  const [historySemis, setHistorySemis] = useState<SemisReconEntry[]>([])

  // ── Inventory Products ──
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState('')
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)
  const [newProduct, setNewProduct] = useState({ name: '', unit: 'kg', category: 'inne', is_food: true, last_price: '' })
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productSaving, setProductSaving] = useState(false)

  // ── Inventory Jobs ──
  const [submittedJobs, setSubmittedJobs] = useState<InventoryJob[]>([])
  const [selectedReviewJob, setSelectedReviewJob] = useState<InventoryJob | null>(null)
  const [reviewJobItems, setReviewJobItems] = useState<InventoryJobItem[]>([])
  const [correctionNote, setCorrectionNote] = useState('')
  const [inventoryHistoryJobs, setInventoryHistoryJobs] = useState<InventoryJob[]>([])
  const [invApprovalsTab, setInvApprovalsTab] = useState<'pending' | 'history'>('pending')

  // ── Monthly Generator ──
  const [monthlyMonth, setMonthlyMonth] = useState('')
  const [monthlyGenerating, setMonthlyGenerating] = useState(false)
  const [existingMonthlyJobs, setExistingMonthlyJobs] = useState<InventoryJob[]>([])

  // ── Weekly Creator ──
  const [weeklyLocations, setWeeklyLocations] = useState<string[]>([])
  const [weeklyProducts, setWeeklyProducts] = useState<string[]>([])
  const [weeklyDeadline, setWeeklyDeadline] = useState('')
  const [weeklyNote, setWeeklyNote] = useState('')
  const [weeklyProductSearch, setWeeklyProductSearch] = useState('')
  const [weeklyCreating, setWeeklyCreating] = useState(false)

  // ── SEMIS Verification ──
  const [pendingSemisEntries, setPendingSemisEntries] = useState<SemisReconEntry[]>([])
  const [semisLoading, setSemisLoading] = useState(false)
  const [semisVerificationNote, setSemisVerificationNote] = useState('')

  // ── Month Close ──
  const [closedMonths, setClosedMonths] = useState<ClosedMonth[]>([])
  const [closeMonth, setCloseMonth] = useState('')
  const [closeYear, setCloseYear] = useState(new Date().getFullYear())
  const [closeLocationId, setCloseLocationId] = useState('')
  const [closing, setClosing] = useState(false)

  // ── Reports ──
  const [reportType, setReportType] = useState<string | null>(null)
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  // ═══════════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0]
      setSelectedDate(today)
      setWeeklyDeadline(today)
      const fom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      setReportFrom(fom); setReportTo(today)
      setMonthlyMonth(today.substring(0, 7))
      setCloseMonth(String(new Date().getMonth() + 1).padStart(2, '0'))

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setAdminId(user.id)
      
      const { data: profile } = await supabase.from('user_profiles').select('full_name, role, company_id').eq('id', user.id).single()
      setAdminName(profile?.full_name || user.email || 'Admin')
      setCompanyId(profile?.company_id || '')

      const { data } = await supabase.from('locations').select('id, name, company_id').order('name')
      if (data) setLocations(data as LocationRow[])
    }
    init()
  }, [supabase, router])

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: Notifications
  // ═══════════════════════════════════════════════════════════════════
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('admin_notifications')
      .select('*, locations:location_id(name)')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (data) {
      const notifs = data.map((n: any) => ({
        ...n,
        location_name: n.locations?.name || 'Nieznana',
      }))
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n: AdminNotification) => n.status === 'unread').length)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Set up real-time subscription
    const channel = supabase
      .channel('admin_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, fetchNotifications)
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const markNotificationRead = async (id: string) => {
    await supabase.from('admin_notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', id)
    fetchNotifications()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: Daily Reports
  // ═══════════════════════════════════════════════════════════════════
  const fetchPendingDailyReports = async () => {
    let q = supabase.from('sales_daily')
      .select('*, locations:location_id(name)')
      .in('status', ['submitted', 'pending']) // Checks for both statuses
      .order('date', { ascending: false })
    
    if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)
    
    const { data } = await q
    if (data) {
      setPendingDailyReports(data.map((r: any) => ({
        ...r,
        location_name: r.locations?.name || 'Nieznana',
      })))
    }
  }

  useEffect(() => {
    if (activeView === 'daily_reports') fetchPendingDailyReports()
  }, [activeView, filterLocationId])

  const openDailyReportDetail = async (report: DailyReport) => {
    setSelectedDailyReport(report)
    
    // Fetch employee hours for this report
    const { data: hours } = await supabase
      .from('employee_daily_hours')
      .select('*, employees:employee_id(full_name)')
      .eq('location_id', report.location_id)
      .eq('date', report.date)
    
    if (hours) {
      setDailyReportEmployeeHours(hours.map((h: any) => ({
        ...h,
        employee_name: h.employees?.full_name || 'Nieznany',
      })))
    }
    
    setActiveView('daily_report_detail')
  }

  const approveDailyReport = async () => {
    if (!selectedDailyReport) return
    
    await supabase.from('sales_daily')
      .update({ status: 'approved', approved_by: adminName, approved_at: new Date().toISOString() })
      .eq('id', selectedDailyReport.id)
    
    // Mark related notification as actioned
    await supabase.from('admin_notifications')
      .update({ status: 'actioned', actioned_at: new Date().toISOString() })
      .eq('reference_id', selectedDailyReport.id)
    
    alert('✅ Raport zatwierdzony')
    setSelectedDailyReport(null)
    setActiveView('daily_reports')
    fetchPendingDailyReports()
    fetchNotifications()
  }

  const rejectDailyReport = async (note: string) => {
    if (!selectedDailyReport || !note.trim()) {
      alert('Podaj powód odrzucenia')
      return
    }
    
    await supabase.from('sales_daily')
      .update({ status: 'rejected', rejection_note: note })
      .eq('id', selectedDailyReport.id)
    
    alert('❌ Raport odrzucony')
    setSelectedDailyReport(null)
    setActiveView('daily_reports')
    fetchPendingDailyReports()
    fetchNotifications()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DATE RANGE
  // ═══════════════════════════════════════════════════════════════════
  const getDateRange = () => {
    const base = selectedDate || new Date().toISOString().split('T')[0]
    const a = new Date(base)
    let s = base, e = base, l = `Dzień: ${base}`
    if (period === 'weekly') {
      const d = a.getDay(), diff = a.getDate() - d + (d === 0 ? -6 : 1)
      const so = new Date(a); so.setDate(diff)
      const eo = new Date(so); eo.setDate(eo.getDate() + 6)
      s = so.toISOString().split('T')[0]; e = eo.toISOString().split('T')[0]
      l = `Tydzień: ${s} – ${e}`
    } else if (period === 'monthly') {
      const y = a.getFullYear(), m = a.getMonth()
      const so = new Date(y, m, 1), eo = new Date(y, m + 1, 0)
      s = so.toISOString().split('T')[0]; e = eo.toISOString().split('T')[0]
      l = `Miesiąc: ${so.toLocaleString('pl-PL', { month: 'long', year: 'numeric' })}`
    }
    return { start: s, end: e, label: l }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: Dashboard (PnL + invoices)
  // ═══════════════════════════════════════════════════════════════════
  const fetchDashboard = async () => {
    setLoading(true)
    const { start, end, label } = getDateRange()
    setDateLabel(label)

    let sq = supabase.from('sales_daily')
      .select('gross_revenue, target_gross_sales, transaction_count, target_transactions, total_labor_hours, avg_hourly_rate, net_revenue, cash_diff, petty_expenses, daily_losses, daily_refunds')
      .gte('date', start).lte('date', end)
    if (filterLocationId !== 'all') sq = sq.eq('location_id', filterLocationId)
    const { data: sales } = await sq

    const grossSales = sales?.reduce((s, r) => s + (Number(r.gross_revenue) || 0), 0) || 0
    const targetGross = sales?.reduce((s, r) => s + (Number(r.target_gross_sales) || 0), 0) || 0
    const netCol = sales?.reduce((s, r) => s + (Number(r.net_revenue) || 0), 0) || 0
    const netSales = netCol > 0 ? netCol : grossSales / (1 + VAT_RATE)
    const planNet = targetGross / (1 + VAT_RATE)
    const vatValue = grossSales - netSales
    const transactions = sales?.reduce((s, r) => s + (Number(r.transaction_count) || 0), 0) || 0
    const planTx = sales?.reduce((s, r) => s + (Number(r.target_transactions) || 0), 0) || 0
    const totalHours = sales?.reduce((s, r) => s + (Number(r.total_labor_hours) || 0), 0) || 0
    const laborCost = sales?.reduce((s, r) => s + (Number(r.total_labor_hours) || 0) * (Number(r.avg_hourly_rate) || 0), 0) || 0
    const laborPercent = netSales > 0 ? laborCost / netSales : 0
    const aov = transactions > 0 ? netSales / transactions : 0
    const salesPerHour = totalHours > 0 ? netSales / totalHours : 0
    const effectiveHourlyRate = totalHours > 0 ? laborCost / totalHours : 0
    const cashDiffTotal = sales?.reduce((s, r) => s + (Number(r.cash_diff) || 0), 0) || 0
    const pettySum = sales?.reduce((s, r) => s + (Number(r.petty_expenses) || 0), 0) || 0
    const lossesSum = sales?.reduce((s, r) => s + (Number(r.daily_losses) || 0), 0) || 0
    const refundsSum = sales?.reduce((s, r) => s + (Number(r.daily_refunds) || 0), 0) || 0
    const opsExtra = pettySum + lossesSum + refundsSum

    let cq = supabase.from('imported_costs').select('amount, cost_type').gte('cost_date', start).lte('cost_date', end)
    if (filterLocationId !== 'all') cq = cq.eq('location_id', filterLocationId)
    const { data: imported } = await cq
    let cogs = 0, opexExcel = 0
    imported?.forEach(c => { const a = Number(c.amount) || 0; c.cost_type === 'COS' ? cogs += a : opexExcel += a })

    let mq = supabase.from('invoices').select('total_amount, total_net, invoice_type').eq('status', 'approved').gte('service_date', start).lte('service_date', end)
    if (filterLocationId !== 'all') mq = mq.eq('location_id', filterLocationId)
    const { data: manual } = await mq
    let cosInv = 0, opexManual = 0
    manual?.forEach(inv => { const a = Number(inv.total_net || inv.total_amount) || 0; inv.invoice_type === 'COS' ? cosInv += a : opexManual += a })
    cogs += cosInv
    const opex = opexExcel + opexManual + opsExtra
    const cogsPercent = netSales > 0 ? cogs / netSales : 0
    const grossMarginValue = netSales - cogs
    const grossMarginPercent = netSales > 0 ? grossMarginValue / netSales : 0
    const totalCosts = cogs + laborCost + opex
    const operatingProfit = netSales - cogs - laborCost - opex
    const netMargin = netSales > 0 ? operatingProfit / netSales : 0

    const newAlerts: string[] = []
    if (laborPercent > LABOR_YELLOW_MAX) newAlerts.push('Koszt pracy powyżej 30%')
    else if (laborPercent > LABOR_GREEN_MAX) newAlerts.push('Koszt pracy zbliża się do 30%')
    if (grossMarginPercent < GROSS_MARGIN_PLAN_PERCENT - 0.02) newAlerts.push('Marża brutto < plan o > 2pp')
    if (planNet > 0 && netSales < planNet * 0.97) newAlerts.push('Sprzedaż netto < plan o > 3%')
    if (Math.abs(cashDiffTotal) > 0.01) newAlerts.push('Różnica w gotówce')

    setPnl({ netSales, grossSales, vatValue, planNet, planGross: targetGross, transactions, planTransactions: planTx, aov, salesPerHour, laborCost, laborPercent, totalHours, effectiveHourlyRate, cogs, cogsPercent, opex, totalCosts, grossMarginValue, grossMarginPercent, operatingProfit, netMargin, cashDiffTotal, pettySum, lossesSum, refundsSum })
    setAlerts(newAlerts)
    setStatusText(operatingProfit >= 0 && newAlerts.length === 0 ? 'Rentowność OK. Brak krytycznych odchyleń.' : 'Uwaga – ' + (newAlerts[0] || 'brak danych'))

    // Pending invoices: Look for BOTH 'submitted' AND 'pending'
    let pq = supabase
      .from('invoices')
      .select('*, locations(name)')
      .in('status', ['submitted', 'pending']) 
      .order('service_date', { ascending: false })
    if (filterLocationId !== 'all') pq = pq.eq('location_id', filterLocationId)
    const { data: pending } = await pq
    if (pending) setPendingInvoices(pending)

    // Imported
    let iq = supabase.from('imported_costs').select('*, locations(name)').gte('cost_date', start).lte('cost_date', end).limit(100)
    if (filterLocationId !== 'all') iq = iq.eq('location_id', filterLocationId)
    const { data: il } = await iq
    if (il) setImportedCosts(il)

    // History: Fetch last 50 processed items (independent of dashboard date)
    let hq = supabase
      .from('invoices')
      .select('*, locations(name)')
      .in('status', ['approved', 'declined'])
      .order('service_date', { ascending: false }) // Most recently processed by service date
      .limit(50)
    
    if (filterLocationId !== 'all') hq = hq.eq('location_id', filterLocationId)
    const { data: hist } = await hq
    if (hist) setHistoryInvoices(hist)

    // History SEMIS: Fetch last 20 processed items
    let hsq = supabase
      .from('semis_reconciliation_entries')
      .select('*, locations:location_id(name)')
      .in('status', ['verified', 'rejected'])
      .order('verified_at', { ascending: false })
      .limit(20)
    
    if (filterLocationId !== 'all') hsq = hsq.eq('location_id', filterLocationId)
    const { data: hsemis } = await hsq
    if (hsemis) setHistorySemis(hsemis)

    setLoading(false)
  }

  useEffect(() => { if (selectedDate) fetchDashboard() }, [period, selectedDate, filterLocationId])

  const updateInvoiceStatus = async (id: string, status: string) => {
    try {
      if (!id) { alert('Brak identyfikatora faktury'); return }
      setLoading(true)

      // 1. Update status in DB and return the updated row (for debugging/confirmation)
      const { data: updated, error: updateError } = await supabase.from('invoices')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // 2. Mark notification as done (ignore if none)
      const { error: notifError } = await supabase.from('admin_notifications')
        .update({ status: 'actioned', actioned_at: new Date().toISOString() })
        .eq('reference_id', id)

      if (notifError) console.warn('Notification update error:', notifError.message)

      // 3. Refresh dashboard & notifications
      await fetchDashboard()
      await fetchNotifications()

      alert(`✅ Faktura ${status === 'approved' ? 'zatwierdzona' : 'odrzucona'}`)
      setLoading(false)
      return updated
    } catch (err: any) {
      console.error('Error updating invoice:', err)
      const msg = err?.message || (err?.error && err.error.message) || String(err)
      alert('❌ Błąd podczas aktualizacji faktury: ' + msg)
      setLoading(false)
    }
  }

  // Ensure inventory approvals counts are loaded on mount so sidebar shows correct counts
  useEffect(() => {
    fetchSubmittedJobs()
    fetchInventoryHistory()
  }, [])

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: SEMIS Verification
  // ═══════════════════════════════════════════════════════════════════
  const fetchPendingSemisEntries = async () => {
    setSemisLoading(true)
    let q = supabase.from('semis_reconciliation_entries')
      .select('*, locations:location_id(name)')
      .in('status', ['submitted', 'pending']) // Checks for both
      .order('submitted_at', { ascending: true })
    
    if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)
    
    const { data } = await q
    if (data) {
      setPendingSemisEntries(data.map((e: any) => ({
        ...e,
        location_name: e.locations?.name || 'Nieznana',
      })))
    }
    setSemisLoading(false)
  }

  useEffect(() => {
    if (activeView === 'semis_verification') fetchPendingSemisEntries()
  }, [activeView, filterLocationId])

  const verifySemisEntry = async (id: string, status: 'verified' | 'rejected') => {
    await supabase.from('semis_reconciliation_entries')
      .update({
        status,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
        verification_note: semisVerificationNote || null,
      })
      .eq('id', id)
    
    setSemisVerificationNote('')
    fetchPendingSemisEntries()
    fetchDashboard() // Updates history
    fetchNotifications()
  }

  const verifySemisBatch = async (status: 'verified' | 'rejected') => {
    if (pendingSemisEntries.length === 0) return
    
    for (const entry of pendingSemisEntries) {
      await supabase.from('semis_reconciliation_entries')
        .update({
          status,
          verified_by: adminId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', entry.id)
    }
    
    // Mark related notifications as actioned
    await supabase.from('admin_notifications')
      .update({ status: 'actioned', actioned_at: new Date().toISOString() })
      .eq('type', 'semis_reconciliation')
      .eq('status', 'unread')
    
    alert(`✅ ${pendingSemisEntries.length} pozycji ${status === 'verified' ? 'zweryfikowanych' : 'odrzuconych'}`)
    fetchPendingSemisEntries()
    fetchDashboard() // Updates history
    fetchNotifications()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: Products
  // ═══════════════════════════════════════════════════════════════════
  const fetchProducts = async () => {
    const { data } = await supabase.from('inventory_products').select('*').order('category').order('name')
    if (data) setInventoryProducts(data as InventoryProduct[])
  }
  useEffect(() => { fetchProducts() }, [])

  const filteredProducts = useMemo(() => {
    let items = inventoryProducts
    if (productSearch) { const q = productSearch.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(q)) }
    if (productCategoryFilter) items = items.filter(p => p.category === productCategoryFilter)
    return items
  }, [inventoryProducts, productSearch, productCategoryFilter])

  const saveNewProduct = async () => {
    if (!newProduct.name.trim()) { alert('Podaj nazwę'); return }
    setProductSaving(true)
    const { error } = await supabase.from('inventory_products').insert({ name: newProduct.name.trim(), unit: newProduct.unit, category: newProduct.category, is_food: newProduct.is_food, last_price: Number(newProduct.last_price) || 0, active: true })
    if (error) alert('Błąd: ' + error.message)
    else { setNewProduct({ name: '', unit: 'kg', category: 'inne', is_food: true, last_price: '' }); setShowAddProduct(false); fetchProducts() }
    setProductSaving(false)
  }

  const updateProduct = async (p: InventoryProduct) => {
    await supabase.from('inventory_products').update({ name: p.name, unit: p.unit, category: p.category, is_food: p.is_food, active: p.active, last_price: p.last_price }).eq('id', p.id)
    setEditingProduct(null); fetchProducts()
  }

  const deleteProduct = async (id: string) => {
    // Check for foreign-key references (inventory_job_items)
    const { data: refs, error: refErr } = await supabase.from('inventory_job_items').select('id').eq('product_id', id).limit(1)
    if (refErr) { alert('Błąd sprawdzania powiązań: ' + refErr.message); return }

    if (refs && refs.length > 0) {
      const doDeactivate = confirm('Produkt jest używany w inwentaryzacjach. Nie można go usunąć. Wyłączyć produkt zamiast usuwać?')
      if (!doDeactivate) return
      const { error: updErr } = await supabase.from('inventory_products').update({ active: false }).eq('id', id)
      if (updErr) alert('Błąd przy wyłączaniu: ' + updErr.message)
      else fetchProducts()
      return
    }

    if (!confirm('Usunąć produkt?')) return
    const { error } = await supabase.from('inventory_products').delete().eq('id', id)
    if (error) alert('Błąd: ' + error.message)
    else fetchProducts()
  }

  const toggleProductActive = async (id: string, active: boolean) => {
    await supabase.from('inventory_products').update({ active: !active }).eq('id', id)
    fetchProducts()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INVENTORY: Monthly
  // ═══════════════════════════════════════════════════════════════════
  const fetchExistingMonthly = async () => {
    if (!monthlyMonth) return
    const [y, m] = monthlyMonth.split('-').map(Number)
    const due = new Date(y, m, 0).toISOString().split('T')[0]
    const { data } = await supabase.from('inventory_jobs').select('*, locations:location_id(name)').eq('type', 'MONTHLY').eq('due_date', due)
    if (data) setExistingMonthlyJobs(data.map((j: any) => ({ ...j, location_name: j.locations?.name || '?' })))
  }
  useEffect(() => { fetchExistingMonthly() }, [monthlyMonth])

  const generateMonthlyJobs = async () => {
    if (!monthlyMonth) return
    setMonthlyGenerating(true)
    const [y, m] = monthlyMonth.split('-').map(Number)
    const due = new Date(y, m, 0).toISOString().split('T')[0]
    const { data: products } = await supabase.from('inventory_products').select('id').eq('is_food', true).eq('active', true)
    if (!products?.length) { alert('Brak aktywnych produktów spożywczych'); setMonthlyGenerating(false); return }
    let created = 0
    for (const loc of locations) {
      if (existingMonthlyJobs.find(j => j.location_id === loc.id)) continue
      const { data: job } = await supabase.from('inventory_jobs').insert({ location_id: loc.id, type: 'MONTHLY', status: 'draft', due_date: due, created_by: adminName, note: `Miesięczna — ${monthlyMonth}` }).select('id').single()
      if (!job) continue
      await supabase.from('inventory_job_items').insert(products.map(p => ({ job_id: job.id, product_id: p.id })))
      created++
    }
    alert(`✅ Utworzono ${created} inwentaryzacji (${products.length} prod. każda)`)
    setMonthlyGenerating(false); fetchExistingMonthly()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INVENTORY: Weekly
  // ═══════════════════════════════════════════════════════════════════
  const toggleWeeklyLoc = (id: string) => setWeeklyLocations(p => p.includes(id) ? p.filter(l => l !== id) : [...p, id])
  const toggleWeeklyProd = (id: string) => setWeeklyProducts(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const filteredWeeklyProducts = useMemo(() => {
    const active = inventoryProducts.filter(p => p.active)
    if (!weeklyProductSearch) return active
    const q = weeklyProductSearch.toLowerCase()
    return active.filter(p => p.name.toLowerCase().includes(q))
  }, [inventoryProducts, weeklyProductSearch])

  const createWeeklyJobs = async () => {
    if (!weeklyLocations.length) { alert('Wybierz lokalizacje'); return }
    if (!weeklyProducts.length) { alert('Wybierz produkty'); return }
    setWeeklyCreating(true)
    let created = 0
    for (const locId of weeklyLocations) {
      const { data: job } = await supabase.from('inventory_jobs').insert({ location_id: locId, type: 'WEEKLY', status: 'draft', due_date: weeklyDeadline, created_by: adminName, note: weeklyNote || `Tygodniowa — ${weeklyProducts.length} poz.` }).select('id').single()
      if (!job) continue
      await supabase.from('inventory_job_items').insert(weeklyProducts.map(pid => ({ job_id: job.id, product_id: pid })))
      created++
    }
    alert(`✅ Utworzono ${created} inwentaryzacji tygodniowych`)
    setWeeklyCreating(false); setWeeklyLocations([]); setWeeklyProducts([]); setWeeklyNote('')
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INVENTORY: Approvals
  // ═══════════════════════════════════════════════════════════════════
  // Find "const fetchSubmittedJobs" and replace with this:
  const fetchSubmittedJobs = async () => {
    try {
      // Simpler, robust query: get all jobs that are not final/draft states and include item counts
      let q = supabase.from('inventory_jobs')
        .select('*, inventory_job_items(id), location_id')
        .not('status', 'in', '(draft,approved,rejected,correction)')
        .order('created_at', { ascending: false })

      if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)

      const { data, error } = await q
      if (error) {
        const msg = error.message || JSON.stringify(error)
        console.error('Inventory Fetch Error (query):', msg, error)
        alert('Błąd pobierania inwentaryzacji: ' + msg)
        setSubmittedJobs([])
        return
      }

      if (!data || data.length === 0) {
        setSubmittedJobs([])
        return
      }

      // Fetch location names separately (handles missing FK relationships)
      const locIds = Array.from(new Set(data.map((j: any) => j.location_id).filter(Boolean)))
      let locMap: Record<string, string> = {}
      if (locIds.length) {
        const { data: locs, error: locErr } = await supabase.from('locations').select('id, name').in('id', locIds)
        if (!locErr && locs) locs.forEach((l: any) => { locMap[l.id] = l.name })
      }

      setSubmittedJobs(data.map((j: any) => ({
        ...j,
        location_name: locMap[j.location_id] || '?',
        item_count: (j.inventory_job_items || []).length
      })))
    } catch (err: any) {
      // Serialize error with non-enumerable props for better debugging
      console.error('Inventory Fetch Error (exception):', err, JSON.stringify(err, Object.getOwnPropertyNames(err)))
      alert('Błąd pobierania inwentaryzacji — sprawdź uprawnienia lub konsolę: ' + (err?.message || String(err)))
      setSubmittedJobs([])
    }
  }

  const fetchInventoryHistory = async () => {
    try {
      let q = supabase.from('inventory_jobs')
        .select('*, inventory_job_items(id), location_id')
        .in('status', ['approved', 'rejected', 'correction'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)

      const { data, error } = await q
      
      if (data) {
        const locIds = Array.from(new Set(data.map((j: any) => j.location_id).filter(Boolean)))
        let locMap: Record<string, string> = {}
        if (locIds.length) {
          const { data: locs, error: locErr } = await supabase.from('locations').select('id, name').in('id', locIds)
          if (!locErr && locs) locs.forEach((l: any) => { locMap[l.id] = l.name })
        }

        setInventoryHistoryJobs(data.map((j: any) => ({
          ...j,
          location_name: locMap[j.location_id] || '?',
          item_count: (j.inventory_job_items || []).length
        })))
      }
    } catch (e) { console.error('Inventory History Fetch Error:', e) }
  }

  useEffect(() => { 
    if (activeView === 'inv_approvals') {
      fetchSubmittedJobs()
      fetchInventoryHistory()
    }
  }, [activeView, filterLocationId])

  const openReviewJob = async (job: InventoryJob) => {
    setSelectedReviewJob(job); setCorrectionNote('')
    const { data } = await supabase.from('inventory_job_items')
      .select('*, inventory_products(name, unit, category, last_price)').eq('job_id', job.id)
    if (data) setReviewJobItems(data.map((i: any) => ({
      id: i.id, job_id: i.job_id, product_id: i.product_id,
      product_name: i.inventory_products?.name || '?', unit: i.inventory_products?.unit || 'szt',
      category: i.inventory_products?.category || 'inne', expected_qty: i.expected_qty,
      counted_qty: i.counted_qty, note: i.note || '', last_price: i.inventory_products?.last_price || null,
    })))
    setActiveView('inv_review')
  }

  const approveJob = async () => {
    if (!selectedReviewJob) return
    await supabase.from('inventory_jobs').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: adminName }).eq('id', selectedReviewJob.id)
    
    // Mark related notification as actioned
    await supabase.from('admin_notifications')
      .update({ status: 'actioned', actioned_at: new Date().toISOString() })
      .eq('reference_id', selectedReviewJob.id)
    
    alert('✅ Zatwierdzona'); setSelectedReviewJob(null); setActiveView('inv_approvals'); fetchSubmittedJobs(); fetchNotifications()
  }

  const sendForCorrection = async () => {
    if (!selectedReviewJob || !correctionNote.trim()) { alert('Wpisz komentarz'); return }
    await supabase.from('inventory_jobs').update({ status: 'correction', note: correctionNote }).eq('id', selectedReviewJob.id)
    alert('↩ Zwrócona do korekty'); setSelectedReviewJob(null); setCorrectionNote(''); setActiveView('inv_approvals'); fetchSubmittedJobs()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MONTH CLOSE
  // ═══════════════════════════════════════════════════════════════════
  const fetchClosedMonths = async () => {
    const { data } = await supabase.from('closed_months').select('*, locations:location_id(name)').order('year', { ascending: false }).order('month', { ascending: false })
    if (data) setClosedMonths(data.map((c: any) => ({ ...c, location_name: c.locations?.name || '?' })))
  }
  useEffect(() => { fetchClosedMonths() }, [])

  const handleCloseMonth = async () => {
    if (!closeLocationId || !closeMonth) { alert('Wybierz lokalizację i miesiąc'); return }
    setClosing(true)
    if (closedMonths.find(c => c.location_id === closeLocationId && c.month === closeMonth && c.year === closeYear)) { alert('⚠ Już zamknięty'); setClosing(false); return }
    const ms = `${closeYear}-${closeMonth}-01`, me = new Date(closeYear, Number(closeMonth), 0).toISOString().split('T')[0]
    const { data: pi } = await supabase.from('invoices').select('id').eq('location_id', closeLocationId).eq('status', 'submitted').gte('service_date', ms).lte('service_date', me)
    if (pi?.length) { alert(`⚠ ${pi.length} faktur oczekuje`); setClosing(false); return }
    const { data: pj } = await supabase.from('inventory_jobs').select('id').eq('location_id', closeLocationId).in('status', ['draft', 'submitted']).eq('type', 'MONTHLY').gte('due_date', ms).lte('due_date', me)
    if (pj?.length) { alert('⚠ Inwentaryzacja niezatwierdzona'); setClosing(false); return }
    const { error } = await supabase.from('closed_months').insert({ location_id: closeLocationId, month: closeMonth, year: closeYear, closed_by: adminName })
    if (error) alert('Błąd: ' + error.message); else { alert('✅ Zamknięto'); fetchClosedMonths() }
    setClosing(false)
  }

  const reopenMonth = async (id: string) => {
    if (!confirm('Otworzyć ponownie?')) return
    await supabase.from('closed_months').delete().eq('id', id); fetchClosedMonths()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REPORTS (all locations)
  // ═══════════════════════════════════════════════════════════════════
  const generateReport = async (type: string) => {
    setReportLoading(true); setReportType(type)
    try {
      if (type === 'daily_all') {
        const { data } = await supabase.from('sales_daily').select('*, locations:location_id(name)').gte('date', reportFrom).lte('date', reportTo).order('date')
        const rows = data || []; const byLoc: Record<string, any> = {}
        rows.forEach((r: any) => {
          const n = r.locations?.name || '?'
          if (!byLoc[n]) byLoc[n] = { name: n, netSales: 0, grossSales: 0, tx: 0, laborCost: 0, days: 0 }
          byLoc[n].netSales += Number(r.net_revenue || r.gross_revenue / (1 + VAT_RATE)) || 0
          byLoc[n].grossSales += Number(r.gross_revenue) || 0
          byLoc[n].tx += Number(r.transaction_count) || 0
          byLoc[n].laborCost += (Number(r.total_labor_hours) || 0) * (Number(r.avg_hourly_rate) || 0)
          byLoc[n].days++
        })
        setReportData({ byLocation: Object.values(byLoc) })
      } else if (type === 'cogs_all') {
        const results: any[] = []
        for (const loc of locations) {
          const { data: p } = await supabase.from('invoices').select('total_net').eq('location_id', loc.id).eq('invoice_type', 'COS').eq('status', 'approved').gte('service_date', reportFrom).lte('service_date', reportTo)
          const tp = (p || []).reduce((s, r: any) => s + (Number(r.total_net) || 0), 0)
          const { data: s } = await supabase.from('sales_daily').select('net_revenue, gross_revenue').eq('location_id', loc.id).gte('date', reportFrom).lte('date', reportTo)
          const tn = (s || []).reduce((sum, r: any) => sum + (Number(r.net_revenue) || (Number(r.gross_revenue) || 0) / (1 + VAT_RATE)), 0)
          results.push({ name: loc.name, totalNet: tn, totalPurchases: tp, margin: tn - tp, marginPct: tn > 0 ? (tn - tp) / tn : 0 })
        }
        setReportData({ locations: results })
      } else if (type === 'labor_all') {
        const results: any[] = []
        for (const loc of locations) {
          const { data } = await supabase.from('sales_daily').select('net_revenue, gross_revenue, total_labor_hours, avg_hourly_rate').eq('location_id', loc.id).gte('date', reportFrom).lte('date', reportTo)
          const rows = data || []
          const ns = rows.reduce((s, r: any) => s + (Number(r.net_revenue) || (Number(r.gross_revenue) || 0) / (1 + VAT_RATE)), 0)
          const h = rows.reduce((s, r: any) => s + (Number(r.total_labor_hours) || 0), 0)
          const c = rows.reduce((s, r: any) => s + (Number(r.total_labor_hours) || 0) * (Number(r.avg_hourly_rate) || 0), 0)
          results.push({ name: loc.name, netSales: ns, hours: h, cost: c, pct: ns > 0 ? c / ns : 0, sph: h > 0 ? ns / h : 0, days: rows.length })
        }
        setReportData({ locations: results })
      } else if (type === 'inventory_all') {
        const { data } = await supabase.from('inventory_jobs')
          .select('*, locations:location_id(name), inventory_job_items(counted_qty, expected_qty, inventory_products(name, last_price, unit))')
          .in('status', ['submitted', 'approved']).order('due_date', { ascending: false }).limit(20)
        setReportData({ jobs: (data || []).map((j: any) => ({ ...j, location_name: j.locations?.name || '?' })) })
      } else if (type === 'semis_all') {
        const { data } = await supabase.from('invoices')
          .select('*, locations:location_id(name)')
          .eq('invoice_type', 'SEMIS')
          .eq('status', 'approved')
          .gte('service_date', reportFrom)
          .lte('service_date', reportTo)
          .order('service_date', { ascending: false })
        
        const byCategory: Record<string, number> = {}
        const byLocation: Record<string, number> = {}
        let total = 0
        
        ;(data || []).forEach((inv: any) => {
          const amt = Number(inv.total_net) || 0
          total += amt
          const cat = inv.semis_category || 'inne'
          byCategory[cat] = (byCategory[cat] || 0) + amt
          const loc = inv.locations?.name || 'Nieznana'
          byLocation[loc] = (byLocation[loc] || 0) + amt
        })
        
        setReportData({ 
          invoices: data || [],
          byCategory: Object.entries(byCategory).map(([k, v]) => ({ category: k, amount: v })),
          byLocation: Object.entries(byLocation).map(([k, v]) => ({ location: k, amount: v })),
          total
        })
      }
    } catch (err: any) { alert('Błąd: ' + err.message) }
    setReportLoading(false)
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  if (!selectedDate) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>

  const laborColor = pnl.laborPercent < LABOR_GREEN_MAX ? 'text-green-700 bg-green-50 border-green-200' : pnl.laborPercent <= LABOR_YELLOW_MAX ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-700 bg-red-50 border-red-200'
  const cashDiffColor = Math.abs(pnl.cashDiffTotal) < 0.01 ? 'text-green-700' : 'text-red-700'

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar
        adminName={adminName}
        activeView={activeView}
        onNavigate={(v) => { setActiveView(v as ActiveView); setReportType(null); setReportData(null); setSelectedReviewJob(null); setSelectedDailyReport(null) }}
        onLogout={async () => { await supabase.auth.signOut(); router.push('/login') }}
        pendingInvoiceCount={pendingInvoices.length}
        pendingInventoryCount={submittedJobs.length}
        unreadNotifications={unreadCount}
      />

      <main className="flex-1 ml-64 p-8">
        {/* ── TOP BAR: Filters ── */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-md px-3 h-10 shadow-sm">
            <MapPin className="w-4 h-4 text-slate-500" />
            <select value={filterLocationId} onChange={e => setFilterLocationId(e.target.value)}
              className="bg-transparent border-none text-sm font-medium outline-none w-48">
              <option value="all">Wszystkie lokalizacje</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white border rounded-md px-2 h-10 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border-none h-8 w-32 p-0 text-sm" />
          </div>
          <div className="flex bg-white rounded-md border p-1 shadow-sm h-10">
            {(['daily', 'weekly', 'monthly'] as const).map(v => (
              <button key={v} onClick={() => setPeriod(v)} className={`px-3 py-1 text-xs font-medium rounded ${period === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {v === 'daily' ? 'Dzień' : v === 'weekly' ? 'Tydzień' : 'Miesiąc'}</button>
            ))}
          </div>
          <span className="text-sm text-slate-500">{dateLabel}</span>
          {loading && <span className="text-sm text-blue-600 animate-pulse">Ładowanie…</span>}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DASHBOARD                                             */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              {unreadCount > 0 && (
                <Button variant="outline" onClick={() => setActiveView('notifications')} className="relative">
                  <Bell className="w-4 h-4 mr-2" />
                  Powiadomienia
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                </Button>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Raporty dzienne', count: pendingDailyReports.length, icon: FileText, view: 'daily_reports', color: 'blue' },
                { label: 'Faktury', count: pendingInvoices.length, icon: Receipt, view: 'approvals', color: 'amber' },
                { label: 'Inwentaryzacje', count: submittedJobs.length, icon: ClipboardList, view: 'inv_approvals', color: 'purple' },
                { label: 'Uzgodnienia SEMIS', count: pendingSemisEntries.length, icon: RefreshCw, view: 'semis_verification', color: 'emerald' },
              ].map(({ label, count, icon: Icon, view, color }) => (
                <Card key={view} className={`cursor-pointer hover:shadow-md transition-shadow ${count > 0 ? `border-${color}-300 bg-${color}-50` : ''}`}
                  onClick={() => setActiveView(view as ActiveView)}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${count > 0 ? `text-${color}-600` : 'text-slate-400'}`} />
                      <span className="font-medium">{label}</span>
                    </div>
                    {count > 0 && (
                      <span className={`bg-${color}-100 text-${color}-700 text-sm font-bold px-2 py-1 rounded-full`}>
                        {count}
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-4 gap-6">
              {[
                { t: 'Sprzedaż netto', v: fmt0(pnl.netSales), sub: `Plan: ${fmt0(pnl.planNet)} | ${pnl.planNet > 0 ? fmtPct(pnl.netSales / pnl.planNet) : '—'}` },
                { t: 'Średni paragon', v: fmt2(pnl.aov), sub: `Tx: ${pnl.transactions}` },
                { t: 'Transakcje', v: String(pnl.transactions), sub: `Plan: ${pnl.planTransactions}` },
                { t: 'Netto / h', v: fmt2(pnl.salesPerHour), sub: `${pnl.totalHours.toFixed(1)} h` },
              ].map((c, i) => (
                <Card key={i}><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">{c.t}</CardTitle></CardHeader>
                  <CardContent><div className="text-3xl font-bold">{c.v}</div><div className="text-xs text-slate-500">{c.sub}</div></CardContent></Card>
              ))}
            </div>
            
            {/* Row 2 */}
            <div className="grid grid-cols-4 gap-6">
              <Card className={`border ${laborColor}`}><CardHeader className="pb-2"><CardTitle className="text-sm">Koszt pracy</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{fmt0(pnl.laborCost)}</div><div className="text-sm font-bold">{fmtPct(pnl.laborPercent)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">COGS</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{fmtPct(pnl.cogsPercent)}</div><div className="text-xs text-slate-500">{fmt0(pnl.cogs)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">OPEX</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-orange-600">{fmt0(pnl.opex)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">EBIT</CardTitle></CardHeader>
                <CardContent><div className={`text-3xl font-bold ${pnl.operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt0(pnl.operatingProfit)}</div>
                  <div className="text-sm">{fmtPct(pnl.netMargin)}</div></CardContent></Card>
            </div>
            
            {/* Status + alerts */}
            <div className="grid grid-cols-3 gap-6">
              <Card className="col-span-2"><CardContent className="pt-6"><p className="font-bold text-slate-900 mb-1">{statusText}</p>
                <p className="text-xs text-slate-500">Gotówka: <span className={cashDiffColor + ' font-bold'}>{fmt2(pnl.cashDiffTotal)}</span> | Drobne: {fmt2(pnl.pettySum)} | Straty: {fmt2(pnl.lossesSum)} | Zwroty: {fmt2(pnl.refundsSum)}</p></CardContent></Card>
              <Card><CardHeader className="pb-1 flex items-center justify-between"><CardTitle className="text-sm text-slate-500">Alerty</CardTitle>
                {alerts.length === 0 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}</CardHeader>
                <CardContent>{alerts.length === 0 ? <p className="text-sm text-slate-400 text-center">Brak</p> : alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-50 border rounded px-2 py-1 text-sm mb-1"><AlertTriangle className="w-3 h-3 text-amber-500 mt-1" />{a}</div>
                ))}</CardContent></Card>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  NOTIFICATIONS                                         */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'notifications' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Powiadomienia</h1>
            <Card>
              <CardContent className="pt-4">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Brak powiadomień</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map(notif => {
                      const Icon = NOTIFICATION_ICONS[notif.type] || Bell
                      const isUnread = notif.status === 'unread'
                      return (
                        <div key={notif.id} 
                          className={`flex items-start gap-4 p-4 rounded-lg border ${isUnread ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUnread ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            <Icon className={`w-5 h-5 ${isUnread ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className={`font-medium ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>{notif.title}</p>
                                <p className="text-sm text-slate-500">{notif.message}</p>
                                <p className="text-xs text-slate-400 mt-1">{notif.location_name} • {new Date(notif.created_at).toLocaleString('pl-PL')}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isUnread && (
                                  <Button size="sm" variant="ghost" onClick={() => markNotificationRead(notif.id)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => {
                                  markNotificationRead(notif.id)
                                  if (notif.type === 'daily_report') setActiveView('daily_reports')
                                  else if (notif.type === 'invoice') setActiveView('approvals')
                                  else if (notif.type === 'inventory') setActiveView('inv_approvals')
                                  else if (notif.type === 'semis_reconciliation') setActiveView('semis_verification')
                                  else setActiveView('notifications')
                                }}>
                                  <ExternalLink className="w-4 h-4 mr-1" />Przejdź
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DAILY REPORTS LIST                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'daily_reports' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Raporty dzienne do zatwierdzenia</h1>
            <Card>
              <CardContent className="pt-4">
                {pendingDailyReports.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Brak raportów do zatwierdzenia</p>
                ) : (
                  <div className="space-y-3">
                    {pendingDailyReports.map(report => {
                      const net = Number(report.net_revenue) || (Number(report.gross_revenue) || 0) / (1 + VAT_RATE)
                      const laborCost = (Number(report.total_labor_hours) || 0) * (Number(report.avg_hourly_rate) || 0)
                      const laborPct = net > 0 ? laborCost / net : 0
                      
                      return (
                        <div key={report.id} 
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 cursor-pointer"
                          onClick={() => openDailyReportDetail(report)}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-bold">{report.location_name}</p>
                              <p className="text-sm text-slate-500">{report.date} • {report.closing_person}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="font-bold">{fmt0(net)}</p>
                              <p className="text-xs text-slate-500">Netto</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${laborPct > 0.3 ? 'text-red-600' : ''}`}>{fmtPct(laborPct)}</p>
                              <p className="text-xs text-slate-500">Praca</p>
                            </div>
                            {Math.abs(Number(report.cash_diff) || 0) > 0.01 && (
                              <div className="text-right">
                                <p className="font-bold text-red-600">{fmt2(Number(report.cash_diff) || 0)}</p>
                                <p className="text-xs text-slate-500">Różn. gotówki</p>
                              </div>
                            )}
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DAILY REPORT DETAIL                                   */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'daily_report_detail' && selectedDailyReport && (
          <div className="space-y-6 max-w-4xl">
            <Button variant="ghost" onClick={() => { setActiveView('daily_reports'); setSelectedDailyReport(null) }}>
              <ArrowLeft className="w-4 h-4 mr-2" />Powrót
            </Button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selectedDailyReport.location_name}</h1>
                <p className="text-slate-500">{selectedDailyReport.date} • {selectedDailyReport.closing_person}</p>
              </div>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">Do zatwierdzenia</span>
            </div>

            {/* Sales Summary */}
            <Card>
              <CardHeader><CardTitle>Sprzedaż</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded p-3">
                    <p className="text-xs text-slate-500 uppercase">Brutto</p>
                    <p className="text-xl font-bold">{fmt0(Number(selectedDailyReport.gross_revenue) || 0)}</p>
                  </div>
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs text-blue-600 uppercase">Netto</p>
                    <p className="text-xl font-bold text-blue-800">{fmt0(Number(selectedDailyReport.net_revenue) || (Number(selectedDailyReport.gross_revenue) || 0) / (1 + VAT_RATE))}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-3">
                    <p className="text-xs text-slate-500 uppercase">Transakcje</p>
                    <p className="text-xl font-bold">{selectedDailyReport.transaction_count}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-3">
                    <p className="text-xs text-slate-500 uppercase">Śr. paragon</p>
                    <p className="text-xl font-bold">
                      {selectedDailyReport.transaction_count > 0 
                        ? fmt2((Number(selectedDailyReport.net_revenue) || (Number(selectedDailyReport.gross_revenue) || 0) / (1 + VAT_RATE)) / selectedDailyReport.transaction_count)
                        : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Labor */}
            <Card>
              <CardHeader><CardTitle>Praca</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const net = Number(selectedDailyReport.net_revenue) || (Number(selectedDailyReport.gross_revenue) || 0) / (1 + VAT_RATE)
                  const laborCost = (Number(selectedDailyReport.total_labor_hours) || 0) * (Number(selectedDailyReport.avg_hourly_rate) || 0)
                  const laborPct = net > 0 ? laborCost / net : 0
                  const isHigh = laborPct > 0.3
                  
                  return (
                    <>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-50 rounded p-3">
                          <p className="text-xs text-slate-500 uppercase">Godziny</p>
                          <p className="text-xl font-bold">{Number(selectedDailyReport.total_labor_hours).toFixed(1)} h</p>
                        </div>
                        <div className="bg-slate-50 rounded p-3">
                          <p className="text-xs text-slate-500 uppercase">Śr. stawka</p>
                          <p className="text-xl font-bold">{fmt2(Number(selectedDailyReport.avg_hourly_rate) || 0)}</p>
                        </div>
                        <div className={`rounded p-3 ${isHigh ? 'bg-red-50' : 'bg-slate-50'}`}>
                          <p className={`text-xs uppercase ${isHigh ? 'text-red-600' : 'text-slate-500'}`}>Koszt</p>
                          <p className={`text-xl font-bold ${isHigh ? 'text-red-700' : ''}`}>{fmt0(laborCost)}</p>
                        </div>
                        <div className={`rounded p-3 ${isHigh ? 'bg-red-50' : 'bg-green-50'}`}>
                          <p className={`text-xs uppercase ${isHigh ? 'text-red-600' : 'text-green-600'}`}>%</p>
                          <p className={`text-xl font-bold ${isHigh ? 'text-red-700' : 'text-green-700'}`}>{fmtPct(laborPct)}</p>
                        </div>
                      </div>
                      
                      {dailyReportEmployeeHours.length > 0 && (
                        <div className="border-t pt-4">
                          <p className="text-sm font-semibold mb-2">Szczegóły godzin:</p>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b text-left text-xs text-slate-500">
                              <th className="py-2">Pracownik</th>
                              <th className="text-right">Godziny</th>
                              <th className="text-right">Stawka</th>
                              <th className="text-right">Koszt</th>
                            </tr></thead>
                            <tbody>
                              {dailyReportEmployeeHours.map((h: any, i: number) => (
                                <tr key={i} className="border-b">
                                  <td className="py-2">{h.employee_name}</td>
                                  <td className="text-right">{Number(h.hours).toFixed(1)} h</td>
                                  <td className="text-right">{fmt2(Number(h.hour_cost) || 0)}</td>
                                  <td className="text-right font-medium">{fmt2(Number(h.daily_cost) || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {isHigh && selectedDailyReport.labor_explanation && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-4">
                          <p className="text-xs font-semibold text-amber-800 mb-1">Wyjaśnienie (praca &gt; 30%):</p>
                          <p className="text-sm text-amber-700">{selectedDailyReport.labor_explanation}</p>
                        </div>
                      )}
                    </>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Cash */}
            <Card>
              <CardHeader><CardTitle>Gotówka</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded p-3">
                    <p className="text-xs text-slate-500 uppercase">Karty</p>
                    <p className="text-xl font-bold">{fmt0(Number(selectedDailyReport.card_payments) || 0)}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-3">
                    <p className="text-xs text-slate-500 uppercase">Gotówka</p>
                    <p className="text-xl font-bold">{fmt0(Number(selectedDailyReport.cash_payments) || 0)}</p>
                  </div>
                  <div className={`rounded p-3 ${Math.abs(Number(selectedDailyReport.cash_diff) || 0) > 0.01 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-xs uppercase">Różnica</p>
                    <p className={`text-xl font-bold ${Math.abs(Number(selectedDailyReport.cash_diff) || 0) > 0.01 ? 'text-red-700' : 'text-green-700'}`}>
                      {fmt2(Number(selectedDailyReport.cash_diff) || 0)}
                    </p>
                  </div>
                </div>
                
                {Math.abs(Number(selectedDailyReport.cash_diff) || 0) > 0.01 && selectedDailyReport.cash_diff_explanation && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 mt-4">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Wyjaśnienie różnicy:</p>
                    <p className="text-sm text-amber-700">{selectedDailyReport.cash_diff_explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Obsada */}
            <Card>
              <CardHeader><CardTitle>Obsada zmian</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">🌅 Rano</p>
                    <p className="text-2xl font-bold">{selectedDailyReport.staff_morning || 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">☀️ Popołudnie</p>
                    <p className="text-2xl font-bold">{selectedDailyReport.staff_afternoon || 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-3 text-center">
                    <p className="text-xs text-slate-500 uppercase">🌙 Wieczór</p>
                    <p className="text-2xl font-bold">{selectedDailyReport.staff_evening || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Incidents & Comments */}
            {(selectedDailyReport.incident_type || selectedDailyReport.comments) && (
              <Card>
                <CardHeader><CardTitle>Zdarzenia i uwagi</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {selectedDailyReport.incident_type && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Zdarzenie: {selectedDailyReport.incident_type}</p>
                      {selectedDailyReport.incident_details && (
                        <p className="text-sm text-amber-700">{selectedDailyReport.incident_details}</p>
                      )}
                    </div>
                  )}
                  {selectedDailyReport.comments && (
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Komentarz:</p>
                      <p className="text-sm">{selectedDailyReport.comments}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="destructive" onClick={() => {
                const note = prompt('Podaj powód odrzucenia:')
                if (note) rejectDailyReport(note)
              }}>
                <ThumbsDown className="w-4 h-4 mr-2" />Odrzuć
              </Button>
              <Button onClick={approveDailyReport} className="bg-green-600 hover:bg-green-700 text-white h-12 px-8 font-bold">
                <ThumbsUp className="w-4 h-4 mr-2" />Zatwierdź raport
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  P&L                                                   */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'pnl' && (
          <Card className="max-w-5xl"><CardContent className="p-8">
            <h3 className="font-bold text-2xl mb-8">Raport P&L</h3>
            <div className="space-y-0">
              <div className="border-b pb-2 mb-2"><span className="text-xs font-bold text-slate-500 uppercase">Przychody</span></div>
              <div className="flex justify-between py-3"><span className="font-bold text-lg">Sprzedaż netto</span><span className="font-bold text-xl">{fmt0(pnl.netSales)}</span></div>
              <div className="flex justify-between pb-4 border-b text-xs text-slate-500"><span>Brutto</span><span>{fmt0(pnl.grossSales)}</span></div>
              <div className="border-b pb-2 mb-2 mt-8"><span className="text-xs font-bold text-slate-500 uppercase">Koszty</span></div>
              {[['COGS', pnl.cogs, pnl.cogsPercent], ['Koszt pracy', pnl.laborCost, pnl.laborPercent], ['OPEX', pnl.opex, pnl.netSales > 0 ? pnl.opex / pnl.netSales : 0]].map(([l, v, p], i) => (
                <div key={i} className="flex justify-between py-3 border-b border-slate-100">
                  <span>{l as string}</span><div><span className="font-mono mr-4">{fmt0(v as number)}</span><span className="text-xs text-slate-500">{fmtPct(p as number)}</span></div></div>
              ))}
              <div className="flex justify-between py-4 bg-slate-50 -mx-8 px-8 border-t mt-2"><span className="font-bold">Suma kosztów</span><span className="font-bold">{fmt0(pnl.totalCosts)}</span></div>
              <div className="border-b pb-2 mb-2 mt-8"><span className="text-xs font-bold text-slate-500 uppercase">Wynik</span></div>
              <div className="flex justify-between py-4"><span className="font-bold text-xl">EBIT</span>
                <span className={`font-bold text-2xl ${pnl.operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt0(pnl.operatingProfit)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Marża netto</span>
                <span className={`font-bold text-lg ${pnl.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtPct(pnl.netMargin)}</span></div>
            </div>
          </CardContent></Card>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INVOICE APPROVALS                                     */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'approvals' && (
          <div><h1 className="text-3xl font-bold mb-6">Faktury do zatwierdzenia</h1>
            <Card><CardContent className="pt-4">
              {pendingInvoices.length === 0 ? <p className="text-center text-slate-400 py-8">Brak faktur do zatwierdzenia</p> :
                pendingInvoices.map(inv => (
                  <div key={inv.id} className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50">
                    <div><p className="font-bold">{inv.supplier_name}</p>
                      <p className="text-sm text-slate-500">{inv.locations?.name} • {inv.service_date} • {fmt0(inv.total_amount || inv.total_net || 0)}</p>
                      {inv.invoice_number && <p className="text-xs text-slate-400">Nr: {inv.invoice_number} | {inv.invoice_type || '—'}</p>}
                      {inv.attachment_url && (
                        <a href={inv.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800 text-xs mt-1 font-medium">
                          <ImageIcon className="w-3 h-3 mr-1" /> Zobacz zdjęcie
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => updateInvoiceStatus(inv.id, 'declined')}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Odrzuć
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                        onClick={() => updateInvoiceStatus(inv.id, 'approved')}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Zatwierdź
                      </Button>
                    </div>
                  </div>
                ))}
            </CardContent></Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  SEMIS VERIFICATION                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'semis_verification' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Weryfikacja uzgodnień SEMIS</h1>
            <p className="text-slate-500">Pozycje wprowadzone przez operatorów do uzgodnienia z księgowością</p>
            
            <Card>
              <CardContent className="pt-4">
                {semisLoading ? (
                  <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                ) : pendingSemisEntries.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Brak pozycji do weryfikacji</p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <p className="font-medium">{pendingSemisEntries.length} pozycji oczekuje</p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => verifySemisBatch('rejected')}>
                          <XCircle className="w-4 h-4 mr-2" />Odrzuć wszystkie
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => verifySemisBatch('verified')}>
                          <CheckCircle className="w-4 h-4 mr-2" />Zatwierdź wszystkie
                        </Button>
                      </div>
                    </div>
                    
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-slate-500 uppercase">
                          <th className="py-2 pr-2">Lokalizacja</th>
                          <th className="pr-2">Nr faktury</th>
                          <th className="pr-2">Dostawca</th>
                          <th className="pr-2">Data</th>
                          <th className="pr-2">Konto</th>
                          <th className="pr-2 text-right">Kwota</th>
                          <th className="pr-2">Opis</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingSemisEntries.map(entry => (
                          <tr key={entry.id} className="border-b hover:bg-slate-50">
                            <td className="py-2 pr-2 font-medium">{entry.location_name}</td>
                            <td className="pr-2">{entry.invoice_number}</td>
                            <td className="pr-2">{entry.supplier || '—'}</td>
                            <td className="pr-2 text-slate-500">{entry.invoice_date}</td>
                            <td className="pr-2 text-slate-500">{entry.accounting_account || '—'}</td>
                            <td className="pr-2 text-right font-medium">{fmt2(entry.amount)}</td>
                            <td className="pr-2 text-xs text-slate-500 max-w-[150px] truncate">{entry.description || '—'}</td>
                            <td className="flex gap-1">
                              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" 
                                onClick={() => verifySemisEntry(entry.id, 'rejected')}>
                                <XCircle className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700"
                                onClick={() => verifySemisEntry(entry.id, 'verified')}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="mt-4 pt-4 border-t bg-slate-50 -mx-6 px-6 py-3 rounded-b">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Suma:</span>
                        <span className="text-xl font-bold">{fmt0(pendingSemisEntries.reduce((s, e) => s + e.amount, 0))}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INVENTORY PRODUCT MANAGEMENT                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'products' && (
          <div><h1 className="text-3xl font-bold mb-6">Produkty magazynowe</h1>
            <Card><CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lista produktów ({inventoryProducts.length})</CardTitle>
              <Button onClick={() => setShowAddProduct(!showAddProduct)} size="sm"><Plus className="w-4 h-4 mr-1" />Dodaj</Button>
            </CardHeader><CardContent className="space-y-4">
              {showAddProduct && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-blue-800">Nowy produkt</h4>
                  <div className="grid grid-cols-5 gap-3">
                    <Input placeholder="Nazwa" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="h-10 rounded-md border border-input px-3 text-sm">{UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select>
                    <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="h-10 rounded-md border border-input px-3 text-sm">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    <Input type="number" placeholder="Cena" value={newProduct.last_price} onChange={e => setNewProduct({...newProduct, last_price: e.target.value})} />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={newProduct.is_food} onChange={e => setNewProduct({...newProduct, is_food: e.target.checked})} />Spożywczy</label>
                      <Button size="sm" onClick={saveNewProduct} disabled={productSaving} className="bg-blue-600 text-white"><Save className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <div className="relative flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input placeholder="Szukaj…" value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-10" /></div>
                <select value={productCategoryFilter} onChange={e => setProductCategoryFilter(e.target.value)} className="h-10 rounded-md border border-input px-3 text-sm"><option value="">Wszystkie</option>{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-slate-500 uppercase">
                <th className="py-2 pr-2">Nazwa</th><th>Kat.</th><th>Jedn.</th><th className="text-right">Cena</th><th>Spoż.</th><th>Aktywny</th><th></th>
              </tr></thead><tbody>{filteredProducts.map(p => (
                <tr key={p.id} className={`border-b hover:bg-slate-50 ${!p.active ? 'opacity-50' : ''}`}>
                  {editingProduct?.id === p.id ? (<>
                    <td className="py-2 pr-2"><Input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="h-8" /></td>
                    <td><select value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="h-8 rounded border px-1 text-xs">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                    <td><select value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} className="h-8 rounded border px-1 text-xs">{UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></td>
                    <td><Input type="number" value={editingProduct.last_price} onChange={e => setEditingProduct({...editingProduct, last_price: Number(e.target.value)})} className="h-8 w-20 text-right" /></td>
                    <td><input type="checkbox" checked={editingProduct.is_food} onChange={e => setEditingProduct({...editingProduct, is_food: e.target.checked})} /></td>
                    <td>{p.active ? '✅' : '❌'}</td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => updateProduct(editingProduct)}><Save className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingProduct(null)}><XCircle className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteProduct(p.id)}><Trash2 className="w-3 h-3" /></Button>
                    </td>
                  </>) : (<>
                    <td className="py-2 pr-2 font-medium">{p.name}</td><td className="text-xs">{p.category}</td><td className="text-xs">{p.unit}</td>
                    <td className="text-right">{fmt2(p.last_price)}</td><td>{p.is_food ? '🍎' : '📦'}</td>
                    <td><button onClick={() => toggleProductActive(p.id, p.active)}>{p.active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}</button></td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingProduct({...p})}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteProduct(p.id)}><Trash2 className="w-3 h-3" /></Button>
                    </td>
                  </>)}
                </tr>
              ))}</tbody></table>
            </CardContent></Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  MONTHLY GENERATOR                                     */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'monthly' && (
          <div><h1 className="text-3xl font-bold mb-6">Generator inwentaryzacji miesięcznej</h1>
            <Card><CardContent className="space-y-6 pt-6">
              <div className="flex items-center gap-4">
                <div className="space-y-1"><Label>Miesiąc</Label><Input type="month" value={monthlyMonth} onChange={e => setMonthlyMonth(e.target.value)} className="w-48" /></div>
                <div className="pt-6"><Button onClick={generateMonthlyJobs} disabled={monthlyGenerating} className="bg-blue-600 text-white h-10">
                  {monthlyGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Generuj dla wszystkich punktów</Button></div>
              </div>
              <p className="text-sm text-slate-500">Utworzy inwentaryzację dla każdego punktu z {inventoryProducts.filter(p => p.is_food && p.active).length} aktywnymi produktami spożywczymi. Termin: ostatni dzień miesiąca.</p>
              {existingMonthlyJobs.length > 0 && (
                <div><h4 className="font-semibold text-sm mb-2">Istniejące:</h4>
                  {existingMonthlyJobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between bg-slate-50 rounded p-3 text-sm mb-2">
                      <span><b>{j.location_name}</b> — {j.due_date}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_LABELS[j.status]?.color}`}>{STATUS_LABELS[j.status]?.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  WEEKLY CREATOR                                        */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'weekly' && (
          <div><h1 className="text-3xl font-bold mb-6">Inwentaryzacja tygodniowa</h1>
            <Card><CardContent className="space-y-6 pt-6">
              <div>
                <div className="flex items-center justify-between mb-2"><Label className="font-semibold">1. Lokalizacje ({weeklyLocations.length})</Label>
                  <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setWeeklyLocations(locations.map(l => l.id))}>Wszystkie</Button><Button size="sm" variant="outline" onClick={() => setWeeklyLocations([])}>Odznacz</Button></div></div>
                <div className="grid grid-cols-4 gap-2">{locations.map(l => (
                  <button key={l.id} onClick={() => toggleWeeklyLoc(l.id)} className={`text-left p-3 rounded border text-sm ${weeklyLocations.includes(l.id) ? 'border-blue-500 bg-blue-50 font-medium' : 'border-gray-200 hover:border-gray-400'}`}>📍 {l.name}</button>
                ))}</div>
              </div>
              <div><Label className="font-semibold mb-2 block">2. Produkty ({weeklyProducts.length})</Label>
                <div className="relative mb-3"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input placeholder="Szukaj…" value={weeklyProductSearch} onChange={e => setWeeklyProductSearch(e.target.value)} className="pl-10" /></div>
                <div className="max-h-60 overflow-y-auto border rounded p-2 space-y-1">{filteredWeeklyProducts.map(p => (
                  <button key={p.id} onClick={() => toggleWeeklyProd(p.id)} className={`w-full text-left px-3 py-2 rounded text-sm ${weeklyProducts.includes(p.id) ? 'bg-blue-50 border border-blue-300 font-medium' : 'hover:bg-gray-50'}`}>
                    {weeklyProducts.includes(p.id) ? '☑' : '☐'} {p.name} <span className="text-xs text-slate-400">({p.category})</span></button>
                ))}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>3. Termin</Label><Input type="date" value={weeklyDeadline} onChange={e => setWeeklyDeadline(e.target.value)} /></div>
                <div className="space-y-1"><Label>4. Notatka (opcjonalnie)</Label><Input placeholder="np. Kontrola braków…" value={weeklyNote} onChange={e => setWeeklyNote(e.target.value)} /></div>
              </div>
              <div className="flex justify-end"><Button onClick={createWeeklyJobs} disabled={weeklyCreating} className="bg-amber-600 hover:bg-amber-700 text-white h-12 px-6 text-lg font-bold">
                {weeklyCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Uruchom ({weeklyLocations.length} × {weeklyProducts.length})</Button></div>
            </CardContent></Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INVENTORY APPROVALS                                   */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'inv_approvals' && (
          <div><h1 className="text-3xl font-bold mb-6">Inwentaryzacje</h1>
            <div className="flex gap-2 mb-6">
              <Button 
                variant={invApprovalsTab === 'pending' ? 'default' : 'outline'}
                onClick={() => setInvApprovalsTab('pending')}
                className="gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                Oczekujące ({submittedJobs.length})
              </Button>
              <Button 
                variant={invApprovalsTab === 'history' ? 'default' : 'outline'}
                onClick={() => setInvApprovalsTab('history')}
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                Historia ({inventoryHistoryJobs.length})
              </Button>
            </div>

            {invApprovalsTab === 'pending' && (
              <Card><CardContent className="pt-4">
                {submittedJobs.length === 0 ? <p className="text-center text-slate-400 py-8">Brak oczekujących inwentaryzacji</p> :
                  submittedJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between border rounded-lg p-4 mb-3 hover:bg-slate-50 cursor-pointer" onClick={() => openReviewJob(job)}>
                      <div><p className="font-bold">{job.location_name}</p>
                        <p className="text-sm text-slate-500">{job.type === 'MONTHLY' ? '📅' : '📋'} {job.type} • {job.due_date} • {job.item_count} poz.</p>
                        {job.submitted_by && <p className="text-xs text-slate-400">Wysłana przez: {job.submitted_by}</p>}</div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  ))}
              </CardContent></Card>
            )}

            {invApprovalsTab === 'history' && (
              <Card><CardContent className="pt-4">
                {inventoryHistoryJobs.length === 0 ? <p className="text-center text-slate-400 py-8">Brak historii inwentaryzacji</p> :
                  <div className="space-y-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-slate-500 uppercase">
                          <th className="py-2 pr-2 font-semibold">Lokalizacja</th>
                          <th className="py-2 pr-2 font-semibold">Typ</th>
                          <th className="py-2 pr-2 font-semibold">Termin</th>
                          <th className="py-2 pr-2 font-semibold">Status</th>
                          <th className="py-2 pr-2 font-semibold">Wysłana</th>
                          <th className="py-2 pr-2 font-semibold">Przez</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryHistoryJobs.map(job => (
                          <tr key={job.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => openReviewJob(job)}>
                            <td className="py-3 pr-2 font-medium">{job.location_name}</td>
                            <td className="py-3 pr-2">{job.type === 'MONTHLY' ? '📅 Miesięczna' : '📋 Tygodniowa'}</td>
                            <td className="py-3 pr-2 text-slate-600">{job.due_date}</td>
                            <td className="py-3 pr-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                job.status === 'approved' ? 'bg-green-100 text-green-700' :
                                job.status === 'correction' ? 'bg-amber-100 text-amber-700' :
                                job.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {job.status === 'approved' ? '✓ Zatwierdzona' :
                                 job.status === 'correction' ? '↩ Do korekty' :
                                 job.status === 'rejected' ? '✕ Odrzucona' : job.status}
                              </span>
                            </td>
                            <td className="py-3 pr-2 text-xs text-slate-500">{job.submitted_at?.split('T')[0]}</td>
                            <td className="py-3 pr-2 text-xs text-slate-500">{job.submitted_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              </CardContent></Card>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INVENTORY REVIEW                                      */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'inv_review' && selectedReviewJob && (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => { setActiveView('inv_approvals'); setSelectedReviewJob(null) }}><ArrowLeft className="w-4 h-4 mr-2" />Powrót</Button>
            <h1 className="text-2xl font-bold">{selectedReviewJob.location_name} — {selectedReviewJob.due_date}</h1>
            <Card><CardContent className="pt-4">
              {(() => {
                const wd = reviewJobItems.filter(i => i.expected_qty != null && i.counted_qty != null && Math.abs(i.counted_qty - i.expected_qty) > 0.01)
                const tv = wd.reduce((s, i) => s + ((i.counted_qty || 0) - (i.expected_qty || 0)) * (i.last_price || 0), 0)
                return (<>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 rounded p-3"><p className="text-xs text-slate-500 uppercase">Pozycji</p><p className="text-2xl font-bold">{reviewJobItems.length}</p></div>
                    <div className="bg-amber-50 rounded p-3"><p className="text-xs text-amber-600 uppercase">Odchylenia</p><p className="text-2xl font-bold text-amber-700">{wd.length}</p></div>
                    <div className={`rounded p-3 ${tv < 0 ? 'bg-red-50' : 'bg-green-50'}`}><p className="text-xs uppercase">Wartość</p><p className={`text-2xl font-bold ${tv < 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt2(tv)}</p></div>
                  </div>
                  <table className="w-full text-sm mb-6"><thead><tr className="border-b text-xs text-slate-500 uppercase text-left">
                    <th className="py-2 pr-2">Produkt</th><th className="pr-2">Kat.</th><th className="pr-2 text-right">Oczekiw.</th><th className="pr-2 text-right">Policzony</th><th className="pr-2 text-right">Różnica</th><th>Uwagi</th>
                  </tr></thead><tbody>{reviewJobItems.map((it, i) => {
                    const d = (it.counted_qty || 0) - (it.expected_qty || 0), hd = it.expected_qty != null && Math.abs(d) > 0.01
                    return (<tr key={i} className={`border-b ${hd ? 'bg-amber-50' : ''}`}>
                      <td className="py-2 pr-2 font-medium">{it.product_name}</td><td className="pr-2 text-xs">{it.category}</td>
                      <td className="pr-2 text-right">{it.expected_qty ?? '—'}</td><td className="pr-2 text-right font-medium">{it.counted_qty ?? '—'}</td>
                      <td className={`pr-2 text-right font-bold ${hd ? d < 0 ? 'text-red-600' : 'text-green-600' : ''}`}>{hd ? `${d > 0 ? '+' : ''}${d.toFixed(1)}` : '—'}</td>
                      <td className="text-xs text-slate-500">{it.note || '—'}</td></tr>)
                  })}</tbody></table>
                  <div className="space-y-3 border-t pt-4">
                    <div className="space-y-2"><Label>Komentarz (jeśli zwracasz do korekty)</Label>
                      <textarea value={correctionNote} onChange={e => setCorrectionNote(e.target.value)} placeholder="Co poprawić…" className="w-full min-h-[60px] rounded-md border border-input bg-gray-50 px-3 py-2 text-sm" /></div>
                    <div className="flex justify-between">
                      <Button variant="destructive" onClick={sendForCorrection} disabled={!correctionNote.trim()}><ArrowLeft className="w-4 h-4 mr-2" />Do korekty</Button>
                      <Button onClick={approveJob} className="bg-green-600 hover:bg-green-700 text-white h-12 px-6 font-bold"><CheckCircle className="w-4 h-4 mr-2" />Zatwierdź</Button>
                    </div>
                  </div>
                </>)
              })()}
            </CardContent></Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  MONTH CLOSE                                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'monthclose' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Zamknięcie miesiąca</h1>
            <Card><CardContent className="space-y-4 pt-6">
              <p className="text-sm text-slate-500">Sprawdza: faktury zatwierdzone, inwentaryzacja zatwierdzona. Blokuje edycję danych z tego okresu.</p>
              <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-6">
                <div className="space-y-2"><Label>Lokalizacja *</Label>
                  <select value={closeLocationId} onChange={e => setCloseLocationId(e.target.value)} className="h-10 w-full rounded-md border border-input px-3 text-sm">
                    <option value="">– wybierz –</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                <div className="space-y-2"><Label>Miesiąc</Label>
                  <select value={closeMonth} onChange={e => setCloseMonth(e.target.value)} className="h-10 w-full rounded-md border border-input px-3 text-sm">
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (<option key={m} value={m}>{new Date(2000, Number(m) - 1).toLocaleString('pl-PL', { month: 'long' })}</option>))}</select></div>
                <div className="space-y-2"><Label>Rok</Label><Input type="number" value={closeYear} onChange={e => setCloseYear(Number(e.target.value))} /></div>
              </div>
              <div className="flex justify-end"><Button onClick={handleCloseMonth} disabled={closing || !closeLocationId} className="bg-red-600 hover:bg-red-700 text-white h-12 px-6 font-bold">
                {closing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}Zamknij</Button></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Historia zamknięć</CardTitle></CardHeader><CardContent>
              {closedMonths.length === 0 ? <p className="text-center text-slate-400 py-4">Brak</p> :
                <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-slate-500 uppercase">
                  <th className="py-2 pr-2">Lokalizacja</th><th>Miesiąc</th><th>Rok</th><th>Kto</th><th>Data</th><th></th>
                </tr></thead><tbody>{closedMonths.map(c => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="py-2 pr-2 font-medium">{c.location_name}</td>
                    <td>{new Date(2000, Number(c.month) - 1).toLocaleString('pl-PL', { month: 'long' })}</td>
                    <td>{c.year}</td><td className="text-slate-500">{c.closed_by}</td><td className="text-slate-500">{c.closed_at?.split('T')[0]}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => reopenMonth(c.id)} className="text-red-500">Otwórz</Button></td>
                  </tr>))}</tbody></table>}
            </CardContent></Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  REPORTS                                               */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'reports' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Raporty zbiorcze</h1>
            {!reportType ? (<>
              <Card className="mb-4"><CardContent className="flex items-center gap-4 py-4">
                <Label>Od:</Label><Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="w-44" />
                <Label>Do:</Label><Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="w-44" />
              </CardContent></Card>
              <div className="grid grid-cols-4 gap-4">
                {[{ t: 'daily_all', i: BarChart3, l: 'Sprzedaż wg lokalizacji', d: 'Netto, tx, praca' },
                  { t: 'cogs_all', i: TrendingUp, l: 'COGS i marża', d: 'Zakupy vs przychody' },
                  { t: 'labor_all', i: Clock, l: 'Praca wg lokalizacji', d: 'Godziny, koszt, efektywność' },
                  { t: 'inventory_all', i: ClipboardList, l: 'Inwentaryzacje', d: 'Odchylenia i wartości' },
                  { t: 'semis_all', i: Receipt, l: 'Koszty SEMIS', d: 'Wg kategorii i lokalizacji' },
                ].map(({ t, i: Icon, l, d }) => (
                  <Card key={t} className="hover:shadow-md cursor-pointer" onClick={() => generateReport(t)}>
                    <CardContent className="py-6"><Icon className="w-8 h-8 text-slate-400 mb-3" /><p className="font-bold">{l}</p><p className="text-sm text-slate-500">{d}</p></CardContent></Card>
                ))}
              </div>
            </>) : (
              <div className="space-y-6">
                <Button variant="ghost" onClick={() => { setReportType(null); setReportData(null) }}><ArrowLeft className="w-4 h-4 mr-2" />Powrót</Button>
                {reportLoading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div> : reportData && (<>
                  {reportType === 'daily_all' && (<Card><CardHeader><CardTitle>Sprzedaż wg lokalizacji</CardTitle></CardHeader><CardContent>
                    <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-slate-500 uppercase">
                      <th className="py-2 pr-2">Lokalizacja</th><th className="pr-2 text-right">Netto</th><th className="pr-2 text-right">Brutto</th><th className="pr-2 text-right">Tx</th><th className="pr-2 text-right">Praca</th><th className="pr-2 text-right">Praca %</th><th className="text-right">Dni</th>
                    </tr></thead><tbody>{reportData.byLocation?.map((l: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        <td className="py-2 pr-2 font-medium">{l.name}</td><td className="pr-2 text-right">{fmt0(l.netSales)}</td><td className="pr-2 text-right">{fmt0(l.grossSales)}</td>
                        <td className="pr-2 text-right">{l.tx}</td><td className="pr-2 text-right">{fmt0(l.laborCost)}</td>
                        <td className={`pr-2 text-right font-bold ${l.netSales > 0 && l.laborCost / l.netSales > 0.3 ? 'text-red-600' : ''}`}>{l.netSales > 0 ? fmtPct(l.laborCost / l.netSales) : '—'}</td>
                        <td className="text-right">{l.days}</td></tr>
                    ))}</tbody></table></CardContent></Card>)}

                  {reportType === 'cogs_all' && (<Card><CardHeader><CardTitle>COGS i marża</CardTitle></CardHeader><CardContent>
                    <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-slate-500 uppercase">
                      <th className="py-2 pr-2">Lokalizacja</th><th className="pr-2 text-right">Netto</th><th className="pr-2 text-right">Zakupy COS</th><th className="pr-2 text-right">Marża</th><th className="text-right">Marża %</th>
                    </tr></thead><tbody>{reportData.locations?.map((l: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-slate-50"><td className="py-2 pr-2 font-medium">{l.name}</td><td className="pr-2 text-right">{fmt0(l.totalNet)}</td>
                        <td className="pr-2 text-right">{fmt0(l.totalPurchases)}</td><td className="pr-2 text-right">{fmt0(l.margin)}</td>
                        <td className={`text-right font-bold ${l.marginPct < 0.6 ? 'text-amber-600' : 'text-green-600'}`}>{fmtPct(l.marginPct)}</td></tr>
                    ))}</tbody></table></CardContent></Card>)}

                  {reportType === 'labor_all' && (<Card><CardHeader><CardTitle>Praca wg lokalizacji</CardTitle></CardHeader><CardContent>
                    <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-slate-500 uppercase">
                      <th className="py-2 pr-2">Lokalizacja</th><th className="pr-2 text-right">Netto</th><th className="pr-2 text-right">Godz.</th><th className="pr-2 text-right">Koszt</th><th className="pr-2 text-right">%</th><th className="text-right">Netto/h</th>
                    </tr></thead><tbody>{reportData.locations?.map((l: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-slate-50"><td className="py-2 pr-2 font-medium">{l.name}</td><td className="pr-2 text-right">{fmt0(l.netSales)}</td>
                        <td className="pr-2 text-right">{l.hours.toFixed(1)}</td><td className="pr-2 text-right">{fmt0(l.cost)}</td>
                        <td className={`pr-2 text-right font-bold ${l.pct > 0.3 ? 'text-red-600' : ''}`}>{fmtPct(l.pct)}</td><td className="text-right">{fmt2(l.sph)}</td></tr>
                    ))}</tbody></table></CardContent></Card>)}

                  {reportType === 'inventory_all' && (<Card><CardHeader><CardTitle>Inwentaryzacje</CardTitle></CardHeader><CardContent>
                    {reportData.jobs?.length === 0 ? <p className="text-center text-slate-400 py-8">Brak</p> :
                      reportData.jobs?.map((j: any, i: number) => {
                        const items = j.inventory_job_items || []
                        const wd = items.filter((it: any) => it.expected_qty != null && it.counted_qty != null && Math.abs(it.counted_qty - it.expected_qty) > 0.01)
                        return (<div key={i} className="border rounded-lg p-4 mb-3">
                          <div className="flex justify-between items-center"><div><p className="font-bold">{j.location_name}</p><p className="text-xs text-slate-500">{j.type} • {j.due_date}</p></div>
                            <div className="text-right text-sm"><p>{items.length} poz.</p><p className={`font-bold ${wd.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>{wd.length} odchyleń</p></div></div>
                          {wd.slice(0, 5).map((it: any, k: number) => { const d = (it.counted_qty || 0) - (it.expected_qty || 0)
                            return (<div key={k} className="flex justify-between text-xs border-t border-gray-100 py-1"><span>{it.inventory_products?.name}</span>
                              <span className={d < 0 ? 'text-red-600' : 'text-green-600'}>{d > 0 ? '+' : ''}{d.toFixed(1)}</span></div>) })}
                        </div>)})}
                  </CardContent></Card>)}

                  {reportType === 'semis_all' && (<Card><CardHeader><CardTitle>Koszty SEMIS</CardTitle></CardHeader><CardContent>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <h4 className="font-semibold mb-3">Wg kategorii</h4>
                        {reportData.byCategory?.map((c: any, i: number) => (
                          <div key={i} className="flex justify-between py-2 border-b">
                            <span>{SEMIS_CATEGORIES[c.category] || c.category}</span>
                            <span className="font-medium">{fmt0(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Wg lokalizacji</h4>
                        {reportData.byLocation?.map((l: any, i: number) => (
                          <div key={i} className="flex justify-between py-2 border-b">
                            <span>{l.location}</span>
                            <span className="font-medium">{fmt0(l.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded p-4 text-center">
                      <p className="text-xs text-emerald-600 uppercase font-semibold">Suma SEMIS</p>
                      <p className="text-3xl font-bold text-emerald-800">{fmt0(reportData.total || 0)}</p>
                    </div>
                  </CardContent></Card>)}
                </>)}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  HISTORY                                               */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'history' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Historia operacji (Ostatnie 50)</h1>
            
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4">Faktury</h2>
              <Card><CardContent className="pt-4">
              {historyInvoices.length === 0 ? (
                <p className="text-center text-slate-400 py-4">Brak faktur</p>
              ) : (
                historyInvoices.map(inv => (
                  <div key={inv.id} className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${inv.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="font-bold">{inv.supplier_name}</p>
                        <p className="text-sm text-slate-500">{inv.locations?.name} • {fmt0(inv.total_amount || 0)}</p>
                        
                        {/* THIS IS THE PART THAT SHOWS THE PHOTO LINK */}
                        {inv.attachment_url && (
                          <a href={inv.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800 text-xs mt-1 font-medium">
                            <ImageIcon className="w-3 h-3 mr-1" /> Zobacz zdjęcie
                          </a>
                        )}
                      </div>
                    </div>
                    <span className="text-xs uppercase font-bold">{inv.status}</span>
                  </div>
                ))
              )}
              </CardContent></Card>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Uzgodnienia SEMIS</h2>
              <Card><CardContent className="pt-4">
                {historySemis.length === 0 ? <p className="text-center text-slate-400 py-4">Brak SEMIS</p> :
                  historySemis.map(semis => (
                    <div key={semis.id} className="flex justify-between items-center border-b py-3 px-2 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${semis.status === 'verified' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-bold">{semis.location_name}</p>
                          <p className="text-sm text-slate-500">{semis.invoice_date} • {semis.description} • {fmt2(semis.amount)}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold uppercase ${semis.status === 'verified' ? 'text-green-600' : 'text-red-600'}`}>{semis.status === 'verified' ? 'zweryfikowana' : 'odrzucona'}</span>
                    </div>
                  ))}
              </CardContent></Card>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  IMPORTED DATA                                         */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'imported' && (
          <div><h1 className="text-3xl font-bold mb-6">Dane z Excela</h1>
            <Card><CardContent className="pt-4">
              <table className="w-full text-sm"><thead className="bg-slate-50"><tr>
                <th className="p-3 text-left">Data</th><th className="p-3 text-left">Lokal</th><th className="p-3 text-left">Dostawca</th>
                <th className="p-3 text-left">Opis</th><th className="p-3 text-left">Typ</th><th className="p-3 text-right">Kwota</th>
              </tr></thead><tbody>
                {importedCosts.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Brak</td></tr>}
                {importedCosts.map((item, i) => (
                  <tr key={i} className="border-t hover:bg-slate-50"><td className="p-3">{item.cost_date}</td><td className="p-3 font-medium">{item.locations?.name}</td>
                    <td className="p-3">{item.supplier}</td><td className="p-3 text-slate-600 truncate max-w-[200px]">{item.account_description}</td>
                    <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{item.cost_type}</span></td>
                    <td className="p-3 text-right font-mono">{item.amount} zł</td></tr>
                ))}
              </tbody></table>
            </CardContent></Card>
          </div>
        )}
      </main>
    </div>
  )
}