'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '../supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Calendar, MapPin, AlertTriangle, CheckCircle, Plus, Trash2,
  Save, Search, Eye, Send, ArrowLeft, ClipboardList, BarChart3,
  Lock, RefreshCw, Loader2, XCircle,
  ChevronRight, Edit2, ToggleLeft, ToggleRight,
  Clock, TrendingUp, AlertCircle, FileText, Receipt, Bell,
  ThumbsUp, ThumbsDown, ExternalLink, ImageIcon
} from 'lucide-react'
import { MenuPricingTable } from '@/components/menu-pricing-table'
import { MenuPriceCalculator } from '@/components/menu-price-calculator'
import { WarehouseDeviationReport } from '@/components/warehouse-deviation-report'
import { CentralWarehousePanel } from '@/components/central-warehouse-panel'
import { DishesManager } from '@/components/dishes-manager'
import { DashboardCharts } from '@/components/dashboard-charts'
import { EmployeesManager } from '@/components/employees-manager'
import type { WeekDay } from '@/components/dashboard-charts'


// ================= Ingredients DB =================
const INGREDIENT_CATEGORIES = [
  'drinks', 'meat', 'dairy', 'vegetables', 'dry', 'packaging', 'other'
];
const INGREDIENT_UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'pack'];

type Ingredient = {
  id: string
  name: string
  category: string
  base_unit: string
  min_threshold?: number | null
  last_price?: number | null
}

function IngredientsSection({ supabase, companyId }: { supabase: SupabaseClient; companyId: string }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [newIngredient, setNewIngredient] = useState<Partial<Record<"name"|"category"|"base_unit"|"min_threshold"|"last_price", string>>>({
    name: "",
    category: "",
    base_unit: "",
    min_threshold: "",
    last_price: ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIngredient, setEditIngredient] = useState<Partial<Ingredient>>({});

  useEffect(() => {
    fetchIngredients();
    // eslint-disable-next-line
  }, [search, categoryFilter, sortBy, sortDir]);

  async function fetchIngredients() {
    let query = supabase.from("ingredients").select("id,name,category,base_unit,min_threshold,last_price");
    if (search) query = query.ilike("name", `%${search}%`);
    if (categoryFilter) query = query.eq("category", categoryFilter);
    query = query.order(sortBy, { ascending: sortDir === "asc" });
    const { data } = await query;
    setIngredients(data || []);
  }

  async function addIngredient() {
    const { name, category, base_unit, min_threshold, last_price } = newIngredient;
    if (!name || !category || !base_unit) return;
    const { data: inserted, error } = await supabase.from("ingredients").insert([
      { name, category, base_unit, min_threshold: Number(min_threshold) || null, last_price: Number(last_price) || 0, company_id: companyId || null }
    ]).select();

    if (error) {
      alert('Błąd: ' + error.message);
      return;
    }

    const ingredientId = inserted?.[0]?.id;
    if (ingredientId && last_price) {
      await supabase.from('ingredient_prices_history').insert([
        { ingredient_id: ingredientId, price: Number(last_price), unit: base_unit }
      ]);
    }

    setNewIngredient({ name: "", category: "", base_unit: "", min_threshold: "", last_price: "" });
    fetchIngredients();
  }

  async function updateIngredient(id: string) {
    const { data: updated, error } = await supabase
      .from("ingredients")
      .update(editIngredient)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      alert('Błąd: ' + error.message);
      return;
    }

    if (editIngredient.last_price !== undefined && updated?.id) {
      const unit = editIngredient.base_unit || updated.base_unit || 'kg';
      await supabase.from('ingredient_prices_history').insert([
        { ingredient_id: updated.id, price: Number(editIngredient.last_price), unit }
      ]);
    }

    setEditingId(null);
    setEditIngredient({});
    fetchIngredients();
  }

  async function deleteIngredient(id: string) {
    if (window.confirm('Czy na pewno chcesz usunąć ten składnik?')) {
      try {
        // Najpierw usuń powiązane transakcje magazynowe, aby nie złamać FK
        const { error: txError } = await supabase
          .from('inventory_transactions')
          .delete()
          .eq('ingredient_id', id);

        if (txError) throw txError;

        // Następnie usuń powiązane rekordy w przepisach
        const { error: recipeError } = await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('ingredient_id', id);

        if (recipeError) throw recipeError;

        const { error } = await supabase.from('ingredients').delete().eq('id', id);
        if (error) throw error;
        fetchIngredients();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : (typeof error === 'object' && error && 'message' in error
                ? // @ts-ignore - Supabase error-like object
                  (error as any).message
                : JSON.stringify(error));
        alert('Błąd podczas usuwania: ' + message);
      }
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Składniki</h1>
      </div>

      {/* Search & Filter + Sort */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Wyszukaj składnik..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-[13px] flex-1"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-8 px-2 text-[12px] border border-[#E5E7EB] rounded-lg bg-white"
        >
          <option value="">Wszystkie kategorie</option>
          {INGREDIENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <div className="flex bg-white border border-[#E5E7EB] rounded-lg p-0.5">
          {[{ v: 'name', l: 'Nazwa' }, { v: 'last_price', l: 'Cena' }].map(s => (
            <button key={s.v} onClick={() => setSortBy(s.v)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${sortBy === s.v ? 'bg-[#111827] text-white' : 'text-[#6B7280]'}`}>
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden mb-4">
        {ingredients.length === 0 ? (
          <p className="text-center text-[#6B7280] py-10 text-[13px]">Brak składników</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="py-2.5 px-4 text-left">Nazwa</th>
                <th className="pr-3 text-left">Kategoria</th>
                <th className="pr-3 text-left">Jednostka</th>
                <th className="pr-3 text-right">Min próg</th>
                <th className="pr-3 text-right">Cena</th>
                <th className="pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map(ing => (
                <tr key={ing.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  {editingId === ing.id ? (
                    <>
                      <td className="py-2 px-4">
                        <Input value={editIngredient.name || ing.name} onChange={e => setEditIngredient({ ...editIngredient, name: e.target.value })} className="h-7 text-[12px]" />
                      </td>
                      <td className="pr-3">
                        <select value={editIngredient.category || ing.category} onChange={e => setEditIngredient({ ...editIngredient, category: e.target.value })} className="h-7 rounded border border-[#E5E7EB] px-1 text-[12px]">
                          {INGREDIENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>
                      <td className="pr-3">
                        <select value={editIngredient.base_unit || ing.base_unit} onChange={e => setEditIngredient({ ...editIngredient, base_unit: e.target.value })} className="h-7 rounded border border-[#E5E7EB] px-1 text-[12px]">
                          {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="pr-3">
                        <Input type="number" value={(editIngredient.min_threshold ?? ing.min_threshold ?? '') as any} onChange={e => setEditIngredient({ ...editIngredient, min_threshold: Number(e.target.value) })} className="h-7 text-[12px] w-20 text-right" />
                      </td>
                      <td className="pr-3">
                        <Input type="number" value={(editIngredient.last_price ?? ing.last_price ?? '') as any} onChange={e => setEditIngredient({ ...editIngredient, last_price: Number(e.target.value) })} className="h-7 text-[12px] w-24 text-right" />
                      </td>
                      <td className="pr-4 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => updateIngredient(ing.id)} className="h-6 w-6 flex items-center justify-center rounded text-[#16A34A] hover:bg-[#F0FDF4]"><CheckCircle className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"><XCircle className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-4 font-semibold text-[#111827]">{ing.name}</td>
                      <td className="pr-3 text-[#6B7280]">{ing.category}</td>
                      <td className="pr-3 text-[#6B7280]">{ing.base_unit}</td>
                      <td className="pr-3 text-right text-[#374151]">{ing.min_threshold || '—'}</td>
                      <td className="pr-3 text-right font-semibold text-[#111827]">{ing.last_price ? `${ing.last_price.toFixed(2)} zł` : '—'}</td>
                      <td className="pr-4 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingId(ing.id); setEditIngredient(ing) }} className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={() => deleteIngredient(ing.id)} className="h-6 w-6 flex items-center justify-center rounded text-[#DC2626] hover:bg-[#FEF2F2]"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Ingredient Form */}
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Dodaj składnik</p>
        <div className="grid grid-cols-6 gap-2">
          <Input placeholder="Nazwa *" value={newIngredient.name} onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })} className="h-8 text-[13px]" />
          <select value={newIngredient.category} onChange={e => setNewIngredient({ ...newIngredient, category: e.target.value })} className="h-8 px-2 text-[12px] border border-[#E5E7EB] rounded-lg bg-white">
            <option value="">Kategoria *</option>
            {INGREDIENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select value={newIngredient.base_unit} onChange={e => setNewIngredient({ ...newIngredient, base_unit: e.target.value })} className="h-8 px-2 text-[12px] border border-[#E5E7EB] rounded-lg bg-white">
            <option value="">Jednostka *</option>
            {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <Input type="number" placeholder="Min próg" value={newIngredient.min_threshold} onChange={e => setNewIngredient({ ...newIngredient, min_threshold: e.target.value })} className="h-8 text-[13px]" />
          <Input type="number" placeholder="Cena (zł)" value={newIngredient.last_price} onChange={e => setNewIngredient({ ...newIngredient, last_price: e.target.value })} className="h-8 text-[13px]" />
          <button onClick={addIngredient} className="h-8 px-3 rounded-lg bg-[#2563EB] text-white text-[12px] font-medium hover:bg-[#1D4ED8] flex items-center justify-center gap-1">
            <Plus className="w-3 h-3" />Dodaj
          </button>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  CONSTANTS                                                          */
/* ================================================================== */
const VAT_RATE = 0.08
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

type MenuPricingDish = {
  id: string
  name: string
  category: string
  productionCost: number
  menuPrice: number
  foodCostPct: number
  marginPerServing: number
  marginGoal: number
  marginPct: number
  status: 'ok' | 'warning' | 'critical'
}

type MenuCalcDish = {
  id: string
  name: string
  foodCost: number
  vatRate: number
  menuPriceNet: number | null
  menuPriceGross: number | null
  marginTarget: number | null
  foodCostTarget: number | null
  status: string | null
}

type ActiveView =
  | 'dashboard' | 'pnl' | 'notifications'
  | 'daily_reports' | 'daily_report_detail'
  | 'approvals' | 'inv_approvals' | 'inv_review'
  | 'semis_verification'
  | 'products' | 'ingredients' | 'dishes' | 'monthly' | 'weekly'
  | 'monthclose'
  | 'reports' | 'history' | 'imported'
  | 'menu_pricing' | 'menu_calculator' | 'warehouse_deviations'
  | 'central_warehouse'
  | 'admin_users' | 'employees'

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
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')

  // ── Notifications ──
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [dbAlerts, setDbAlerts] = useState<any[]>([])
  const [pendingInvTxs, setPendingInvTxs] = useState<any[]>([])

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

  // ── Menu Pricing Dishes ──
  const [menuPricingDishes, setMenuPricingDishes] = useState<MenuPricingDish[]>([])
  const [menuPricingLoading, setMenuPricingLoading] = useState(false)

  // ── Menu Calculator ──
  const [menuCalcDishes, setMenuCalcDishes] = useState<MenuCalcDish[]>([])
  const [menuCalcLoading, setMenuCalcLoading] = useState(false)
  const [selectedCalcDishId, setSelectedCalcDishId] = useState<string>('')
  const [menuCalcSaving, setMenuCalcSaving] = useState(false)

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

  // ── Chart data ──
  const [weeklyChartData, setWeeklyChartData] = useState<WeekDay[]>([])

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
      if (!user) { router.push('/auth/login'); return }
      setAdminId(user.id)
      
      const { data: profile } = await supabase.from('user_profiles').select('full_name, role, company_id, subscription_plan').eq('id', user.id).single()
      setAdminName(profile?.full_name || user.email || 'Admin')
      setCompanyId(profile?.company_id || '')
      setSubscriptionPlan((profile as any)?.subscription_plan || null)

      // Load locations — filter by company_id if set, otherwise show all (legacy accounts)
      let locQuery = supabase
        .from('locations')
        .select('id, name, company_id')
        .order('name')
      if (profile?.company_id) {
        locQuery = locQuery.or(`company_id.eq.${profile.company_id},company_id.is.null`)
      }
      const { data: locData } = await locQuery
      if (locData) setLocations(locData as LocationRow[])
    }
    init()
  }, [supabase, router])

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: Notifications
  // ═══════════════════════════════════════════════════════════════════
  const fetchNotifications = async () => {
    if (!companyId) return
    const { data } = await supabase
      .from('admin_notifications')
      .select('*, locations:location_id(name)')
      .eq('company_id', companyId)
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
    if (!companyId) return
    fetchNotifications()
    const channel = supabase
      .channel('admin_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, fetchNotifications)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, companyId])

  // Fetch alerts — scoped to company via company_id
  const fetchAlerts = async () => {
    let q = supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(100)
    if (companyId) q = q.eq('company_id', companyId)
    const { data } = await q
    if (data) setDbAlerts(data)
  }

  // Fetch recent inventory transactions — scoped to company locations
  const fetchPendingInvTxs = async () => {
    const locationIds = locations.map(l => l.id)
    if (locationIds.length === 0) { setPendingInvTxs([]); return }
    const { data } = await supabase.from('inventory_transactions')
      .select('*, ingredients(name, unit)')
      .in('location_id', locationIds)
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setPendingInvTxs(data)
  }

  useEffect(() => {
    if (!companyId) return
    fetchAlerts(); fetchPendingInvTxs()
    const ch1 = supabase
      .channel('alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, fetchAlerts)
      .subscribe()
    const ch2 = supabase
      .channel('inv_tx')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory_transactions' }, fetchPendingInvTxs)
      .subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [supabase, companyId, locations])

  const markAlertStatus = async (id: string, status: string) => {
    await supabase.from('alerts').update({ status }).eq('id', id)
    fetchAlerts()
  }

  const createInvNotification = async (tx: any) => {
    await supabase.from('admin_notifications').insert({
      type: 'inventory',
      location_id: tx.location_id,
      company_id: companyId,
      title: `Review inventory tx - ${tx.id}`,
      message: `Inventory tx for ${tx.ingredient_id || tx.ingredients?.name || 'unknown'}: ${tx.quantity} ${tx.unit} @ ${tx.price}`,
      reference_id: tx.id,
      status: 'unread',
      created_by: adminId,
    })
    fetchNotifications()
  }

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
    const locIds = locations.map(l => l.id)
    if (!locIds.length) { setPendingDailyReports([]); return }
    let q = supabase.from('sales_daily')
      .select('*, locations:location_id(name)')
      .in('status', ['submitted', 'pending'])
      .order('date', { ascending: false })
    if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)
    else q = q.in('location_id', locIds)
    
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
    const locIds = locations.map(l => l.id)

    let sq = supabase.from('sales_daily')
      .select('gross_revenue, target_gross_sales, transaction_count, target_transactions, total_labor_hours, avg_hourly_rate, net_revenue, cash_diff, petty_expenses, daily_losses, daily_refunds')
      .gte('date', start).lte('date', end)
    if (filterLocationId !== 'all') sq = sq.eq('location_id', filterLocationId)
    else if (locIds.length) sq = sq.in('location_id', locIds)
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
    else if (locIds.length) cq = cq.in('location_id', locIds)
    const { data: imported } = await cq
    let cogs = 0, opexExcel = 0
    imported?.forEach(c => { const a = Number(c.amount) || 0; c.cost_type === 'COS' ? cogs += a : opexExcel += a })

    let mq = supabase.from('invoices').select('total_amount, total_net, invoice_type').eq('status', 'approved').gte('service_date', start).lte('service_date', end)
    if (filterLocationId !== 'all') mq = mq.eq('location_id', filterLocationId)
    else if (locIds.length) mq = mq.in('location_id', locIds)
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
    else if (locIds.length) pq = pq.in('location_id', locIds)
    const { data: pending } = await pq
    if (pending) setPendingInvoices(pending)

    // Imported
    let iq = supabase.from('imported_costs').select('*, locations(name)').gte('cost_date', start).lte('cost_date', end).limit(100)
    if (filterLocationId !== 'all') iq = iq.eq('location_id', filterLocationId)
    else if (locIds.length) iq = iq.in('location_id', locIds)
    const { data: il } = await iq
    if (il) setImportedCosts(il)

    // History: Fetch last 50 processed items (independent of dashboard date)
    let hq = supabase
      .from('invoices')
      .select('*, locations(name)')
      .in('status', ['approved', 'declined'])
      .order('service_date', { ascending: false })
      .limit(50)
    if (filterLocationId !== 'all') hq = hq.eq('location_id', filterLocationId)
    else if (locIds.length) hq = hq.in('location_id', locIds)
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
    else if (locIds.length) hsq = hsq.in('location_id', locIds)
    const { data: hsemis } = await hsq
    if (hsemis) setHistorySemis(hsemis)

    // ── Weekly trend for chart ──
    const DAY_NAMES = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']
    const todayDate = new Date()
    const sevenDaysAgo = new Date(todayDate.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    let wq = supabase.from('sales_daily').select('date, net_revenue, gross_revenue').gte('date', sevenDaysAgo).lte('date', todayDate.toISOString().split('T')[0])
    if (filterLocationId !== 'all') wq = wq.eq('location_id', filterLocationId)
    else if (locIds.length) wq = wq.in('location_id', locIds)
    const { data: weeklyRaw } = await wq
    const byDate = new Map<string, number>()
    weeklyRaw?.forEach((r: any) => {
      const rev = Number(r.net_revenue) || (Number(r.gross_revenue) || 0) / (1 + VAT_RATE)
      byDate.set(r.date, (byDate.get(r.date) || 0) + rev)
    })
    const built: WeekDay[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000)
      const ds = d.toISOString().split('T')[0]
      built.push({ day: DAY_NAMES[d.getDay()], date: ds, revenue: byDate.get(ds) || 0 })
    }
    setWeeklyChartData(built)

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

  // Ensure inventory approvals counts are loaded once locations are ready
  useEffect(() => {
    if (!locations.length) return
    fetchSubmittedJobs()
    fetchInventoryHistory()
  }, [locations])

  // ═══════════════════════════════════════════════════════════════════
  //  FETCH: SEMIS Verification
  // ═══════════════════════════════════════════════════════════════════
  const fetchPendingSemisEntries = async () => {
    const locIds = locations.map(l => l.id)
    if (!locIds.length) { setPendingSemisEntries([]); setSemisLoading(false); return }
    setSemisLoading(true)
    let q = supabase.from('semis_reconciliation_entries')
      .select('*, locations:location_id(name)')
      .in('status', ['submitted', 'pending'])
      .order('submitted_at', { ascending: true })
    if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)
    else q = q.in('location_id', locIds)
    
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
    if (!companyId) return
    const { data } = await supabase
      .from('inventory_products')
      .select('*')
      .eq('company_id', companyId)
      .order('category')
      .order('name')
    if (data) setInventoryProducts(data as InventoryProduct[])
  }
  useEffect(() => { fetchProducts() }, [companyId])

  useEffect(() => {
    if (activeView === 'menu_pricing') {
      fetchMenuPricingDishes()
    }
  }, [activeView])

  useEffect(() => {
    if (activeView === 'menu_calculator') {
      fetchMenuCalcDishes()
    }
  }, [activeView])

  // ── Fetch menu pricing dishes ──
  const fetchMenuPricingDishes = async () => {
    setMenuPricingLoading(true)
    let dq = supabase
      .from('dishes')
      .select('id, dish_name, menu_price_gross, menu_price_net, margin_target, status, recipe_id, recipes(category)')
      .order('dish_name')
    if (companyId) dq = dq.eq('company_id', companyId)
    const { data } = await dq

    const rows = data || []
    const mapped = await Promise.all(
      rows.map(async (d: any) => {
        let foodCost = 0
        try {
          const { data: costData } = await supabase.rpc('calculate_dish_foodcost', { dish_id_param: d.id })
          foodCost = Number(costData || 0)
        } catch {
          foodCost = 0
        }

        const price = Number(d.menu_price_gross ?? d.menu_price_net ?? 0)
        const foodCostPct = price > 0 ? (foodCost / price) * 100 : 0
        const marginPct = price > 0 ? ((price - foodCost) / price) * 100 : 0
        const marginPerServing = price - foodCost
        const marginGoal = Number(d.margin_target ?? 0.7) * 100
        let status: 'ok' | 'warning' | 'critical' = 'ok'
        if (foodCostPct > 35) status = 'warning'
        if (foodCostPct > 40) status = 'critical'

        return {
          id: d.id,
          name: d.dish_name,
          category: d.recipes?.category || 'Uncategorized',
          productionCost: Number(foodCost.toFixed(2)),
          menuPrice: Number(price.toFixed(2)),
          foodCostPct: Number(foodCostPct.toFixed(1)),
          marginPerServing: Number(marginPerServing.toFixed(2)),
          marginGoal: Number(marginGoal.toFixed(0)),
          marginPct: Number(marginPct.toFixed(1)),
          status,
        } as MenuPricingDish
      })
    )

    setMenuPricingDishes(mapped)
    setMenuPricingLoading(false)
  }

  const fetchMenuCalcDishes = async () => {
    setMenuCalcLoading(true)
    let dq2 = supabase
      .from('dishes')
      .select('id, dish_name, vat_rate, menu_price_net, menu_price_gross, margin_target, food_cost_target, status, recipe_id')
      .order('dish_name')
    if (companyId) dq2 = dq2.eq('company_id', companyId)
    const { data } = await dq2

    const rows = data || []
    const mapped = await Promise.all(
      rows.map(async (d: any) => {
        let foodCost = 0
        try {
          const { data: costData, error: rpcError } = await supabase.rpc('calculate_dish_foodcost', { dish_id_param: d.id })
          if (rpcError) {
            console.error(`RPC error for dish ${d.id}:`, rpcError)
          }
          // Handle both scalar and object responses from RPC
          if (costData !== null && costData !== undefined) {
            foodCost = typeof costData === 'object' ? Number(costData.total || costData.food_cost || 0) : Number(costData)
          }
          console.log(`Dish ${d.id} (${d.dish_name}): foodCost=${foodCost}`)
        } catch (err) {
          console.error(`Exception calculating foodcost for ${d.id}:`, err)
          foodCost = 0
        }

        return {
          id: d.id,
          name: d.dish_name,
          foodCost: Number(foodCost.toFixed(2)),
          vatRate: Number(d.vat_rate ?? 8),
          menuPriceNet: Number(d.menu_price_net || 0),
          menuPriceGross: Number(d.menu_price_gross || 0),
          marginTarget: Number(d.margin_target || 0.7),
          foodCostTarget: Number(d.food_cost_target || 0.3),
          status: d.status || 'active',
        } as MenuCalcDish
      })
    )

    setMenuCalcDishes(mapped)
    if (mapped.length && !selectedCalcDishId) {
      setSelectedCalcDishId(mapped[0].id)
    }
    setMenuCalcLoading(false)
  }

  const saveMenuCalcPrice = async (dishId: string, grossPrice: number, marginTarget: number, vatRate: number) => {
    if (!dishId) return
    setMenuCalcSaving(true)
    try {
      const menuPriceGross = Number(grossPrice) || 0
      const menuPriceNet = menuPriceGross > 0 ? menuPriceGross / (1 + vatRate / 100) : 0
      const { error } = await supabase
        .from('dishes')
        .update({
          menu_price_gross: menuPriceGross,
          menu_price_net: menuPriceNet,
          margin_target: marginTarget,
        })
        .eq('id', dishId)

      if (error) {
        alert('Błąd: ' + error.message)
        return
      }

      setMenuCalcDishes(prev => prev.map(d => (
        d.id === dishId
          ? { ...d, menuPriceGross, menuPriceNet, marginTarget }
          : d
      )))
    } finally {
      setMenuCalcSaving(false)
    }
  }

  const filteredProducts = useMemo(() => {
    let items = inventoryProducts
    if (productSearch) { const q = productSearch.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(q)) }
    if (productCategoryFilter) items = items.filter(p => p.category === productCategoryFilter)
    return items
  }, [inventoryProducts, productSearch, productCategoryFilter])

  const saveNewProduct = async () => {
    if (!newProduct.name.trim()) { alert('Podaj nazwę'); return }
    setProductSaving(true)
    const { error } = await supabase.from('inventory_products').insert({ name: newProduct.name.trim(), unit: newProduct.unit, category: newProduct.category, is_food: newProduct.is_food, last_price: Number(newProduct.last_price) || 0, active: true, company_id: companyId || null })
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
    const locIds = locations.map(l => l.id)
    try {
      const [y, m] = monthlyMonth.split('-').map(Number)
      const due = new Date(y, m, 0).toISOString().split('T')[0]
      let q = supabase.from('inventory_jobs').select('*, locations:location_id(name)').eq('type', 'MONTHLY').eq('due_date', due)
      if (locIds.length) q = q.in('location_id', locIds)
      const { data, error } = await q
      if (error) {
        console.warn('⚠️ Warning fetching monthly jobs:', error)
        setExistingMonthlyJobs([])
        return
      }
      if (data) setExistingMonthlyJobs(data.map((j: any) => ({ ...j, location_name: j.locations?.name || '?' })))
    } catch (err) {
      console.error('❌ Error in fetchExistingMonthly:', err)
      setExistingMonthlyJobs([])
    }
  }
  useEffect(() => { fetchExistingMonthly() }, [monthlyMonth])

  const generateMonthlyJobs = async () => {
    if (!monthlyMonth) return
    setMonthlyGenerating(true)
    const [y, m] = monthlyMonth.split('-').map(Number)
    const due = new Date(y, m, 0).toISOString().split('T')[0]
    let prodQ = supabase.from('inventory_products').select('id').eq('is_food', true).eq('active', true)
    if (companyId) prodQ = prodQ.eq('company_id', companyId)
    const { data: products } = await prodQ
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
      const locIds = locations.map(l => l.id)
      if (!locIds.length) { setSubmittedJobs([]); return }
      let q = supabase.from('inventory_jobs')
        .select('*, inventory_job_items(id), location_id')
        .not('status', 'in', '(draft,approved,rejected,correction)')
        .order('created_at', { ascending: false })
      if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)
      else q = q.in('location_id', locIds)

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
      const jobLocIds = Array.from(new Set(data.map((j: any) => j.location_id).filter(Boolean)))
      const locMap: Record<string, string> = {}
      if (jobLocIds.length) {
        const { data: locs, error: locErr } = await supabase.from('locations').select('id, name').in('id', jobLocIds)
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
      const locIds = locations.map(l => l.id)
      if (!locIds.length) { setInventoryHistoryJobs([]); return }
      let q = supabase.from('inventory_jobs')
        .select('*, inventory_job_items(id), location_id')
        .in('status', ['approved', 'rejected', 'correction'])
        .order('created_at', { ascending: false })
        .limit(50)
      if (filterLocationId !== 'all') q = q.eq('location_id', filterLocationId)
      else q = q.in('location_id', locIds)

      const { data, error } = await q
      
      if (data) {
        const histLocIds = Array.from(new Set(data.map((j: any) => j.location_id).filter(Boolean)))
        const locMap: Record<string, string> = {}
        if (histLocIds.length) {
          const { data: locs, error: locErr } = await supabase.from('locations').select('id, name').in('id', histLocIds)
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
    const locIds = locations.map(l => l.id)
    if (!locIds.length) { setClosedMonths([]); return }
    let q = supabase.from('closed_months').select('*, locations:location_id(name)').order('year', { ascending: false }).order('month', { ascending: false })
    q = q.in('location_id', locIds)
    const { data } = await q
    if (data) setClosedMonths(data.map((c: any) => ({ ...c, location_name: c.locations?.name || '?' })))
  }
  useEffect(() => { fetchClosedMonths() }, [locations])

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
    const locIds = locations.map(l => l.id)
    try {
      if (type === 'daily_all') {
        let rq = supabase.from('sales_daily').select('*, locations:location_id(name)').gte('date', reportFrom).lte('date', reportTo).order('date')
        if (locIds.length) rq = rq.in('location_id', locIds)
        const { data } = await rq
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
        let iq2 = supabase.from('inventory_jobs')
          .select('*, locations:location_id(name), inventory_job_items(counted_qty, expected_qty, inventory_products(name, last_price, unit))')
          .in('status', ['submitted', 'approved']).order('due_date', { ascending: false }).limit(20)
        if (locIds.length) iq2 = iq2.in('location_id', locIds)
        const { data } = await iq2
        setReportData({ jobs: (data || []).map((j: any) => ({ ...j, location_name: j.locations?.name || '?' })) })
      } else if (type === 'semis_all') {
        let sq2 = supabase.from('invoices')
          .select('*, locations:location_id(name)')
          .eq('invoice_type', 'SEMIS')
          .eq('status', 'approved')
          .gte('service_date', reportFrom)
          .lte('service_date', reportTo)
          .order('service_date', { ascending: false })
        if (locIds.length) sq2 = sq2.in('location_id', locIds)
        const { data } = await sq2
        
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
    <div className="flex bg-[#F7F8FA] min-h-screen">
      <Sidebar
        adminName={adminName}
        activeView={activeView}
        subscriptionPlan={subscriptionPlan || undefined}
        onNavigate={(v) => {
          if (v === 'admin_users') {
            router.push('/admin/users')
            return
          }
          setActiveView(v as ActiveView)
          setReportType(null)
          setReportData(null)
          setSelectedReviewJob(null)
          setSelectedDailyReport(null)
        }}
        onLogout={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
        pendingInvoiceCount={pendingInvoices.length}
        pendingInventoryCount={submittedJobs.length}
        unreadNotifications={unreadCount}
      />

      <main className="flex-1 ml-[216px] p-8">
        {/* ── TOP BAR ── */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-lg px-3 h-9">
            <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <select value={filterLocationId} onChange={e => setFilterLocationId(e.target.value)}
              className="bg-transparent border-none text-[13px] font-medium text-[#111827] outline-none w-48">
              <option value="all">Wszystkie lokalizacje</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-lg px-3 h-9">
            <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border-none h-7 w-32 p-0 text-[13px] shadow-none focus-visible:ring-0" />
          </div>
          <div className="flex bg-white rounded-lg border border-[#E5E7EB] p-0.5 h-9 items-center">
            {(['daily', 'weekly', 'monthly'] as const).map(v => (
              <button key={v} onClick={() => setPeriod(v)} className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors ${period === v ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:text-[#111827]'}`}>
                {v === 'daily' ? 'Dzień' : v === 'weekly' ? 'Tydzień' : 'Miesiąc'}</button>
            ))}
          </div>
          {dateLabel && <span className="text-[13px] text-[#6B7280]">{dateLabel}</span>}
          {loading && <span className="text-[12px] text-[#2563EB] animate-pulse">Ładowanie…</span>}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DASHBOARD                                             */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'dashboard' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Dashboard</h1>
                <p className="text-[13px] text-[#6B7280] mt-0.5">{dateLabel || 'Dzisiaj'}</p>
              </div>
              {unreadCount > 0 && (
                <button onClick={() => setActiveView('notifications')}
                  className="flex items-center gap-2 h-8 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
                  <Bell className="w-3.5 h-3.5" />
                  Powiadomienia
                  <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </button>
              )}
            </div>

            {/* Pending actions */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Raporty dzienne', count: pendingDailyReports.length, icon: FileText, view: 'daily_reports' },
                { label: 'Faktury', count: pendingInvoices.length, icon: Receipt, view: 'approvals' },
                { label: 'Inwentaryzacje', count: submittedJobs.length, icon: ClipboardList, view: 'inv_approvals' },
                { label: 'Uzgodnienia SEMIS', count: pendingSemisEntries.length, icon: RefreshCw, view: 'semis_verification' },
              ].map(({ label, count, icon: Icon, view }) => (
                <button key={view} onClick={() => setActiveView(view as ActiveView)}
                  className="bg-white border border-[#E5E7EB] rounded-lg p-4 text-left hover:border-[#2563EB] transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#2563EB]" />
                    {count > 0 && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626] text-[11px] font-bold px-1.5">
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-[#111827]">{label}</p>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">{count > 0 ? `${count} oczekuje` : 'Brak oczekujących'}</p>
                </button>
              ))}
            </div>

            {/* KPI Row 1 */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { t: 'Sprzedaż netto', v: fmt0(pnl.netSales), sub: `Plan: ${fmt0(pnl.planNet)}` },
                { t: 'Średni paragon', v: fmt2(pnl.aov), sub: `${pnl.transactions} transakcji` },
                { t: 'Transakcje', v: String(pnl.transactions), sub: `Plan: ${pnl.planTransactions}` },
                { t: 'Netto / godz.', v: fmt2(pnl.salesPerHour), sub: `${pnl.totalHours.toFixed(1)} godz.` },
              ].map((c, i) => (
                <div key={i} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{c.t}</p>
                  <p className="text-[26px] font-bold text-[#111827] mt-1 leading-none">{c.v}</p>
                  <p className="text-[12px] text-[#6B7280] mt-1.5">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* KPI Row 2 */}
            <div className="grid grid-cols-4 gap-3">
              <div className={`border rounded-lg p-4 ${pnl.laborPercent < LABOR_GREEN_MAX ? 'bg-white border-[#E5E7EB]' : pnl.laborPercent <= LABOR_YELLOW_MAX ? 'bg-[#FFFBEB] border-[#F59E0B]' : 'bg-[#FEF2F2] border-[#DC2626]'}`}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Koszt pracy</p>
                <p className="text-[26px] font-bold text-[#111827] mt-1 leading-none">{fmt0(pnl.laborCost)}</p>
                <p className={`text-[13px] font-bold mt-1.5 ${pnl.laborPercent < LABOR_GREEN_MAX ? 'text-[#16A34A]' : pnl.laborPercent <= LABOR_YELLOW_MAX ? 'text-[#F59E0B]' : 'text-[#DC2626]'}`}>{fmtPct(pnl.laborPercent)}</p>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">COGS</p>
                <p className="text-[26px] font-bold text-[#111827] mt-1 leading-none">{fmtPct(pnl.cogsPercent)}</p>
                <p className="text-[12px] text-[#6B7280] mt-1.5">{fmt0(pnl.cogs)}</p>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">OPEX</p>
                <p className="text-[26px] font-bold text-[#F59E0B] mt-1 leading-none">{fmt0(pnl.opex)}</p>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">EBIT</p>
                <p className={`text-[26px] font-bold mt-1 leading-none ${pnl.operatingProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{fmt0(pnl.operatingProfit)}</p>
                <p className="text-[12px] text-[#6B7280] mt-1.5">{fmtPct(pnl.netMargin)}</p>
              </div>
            </div>

            {/* Charts */}
            <DashboardCharts pnl={pnl} weeklyData={weeklyChartData} />

            {/* Status + alerts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-lg p-4">
                <p className="text-[13px] font-semibold text-[#111827] mb-1">{statusText || 'Brak danych dla wybranego okresu'}</p>
                <p className="text-[12px] text-[#6B7280]">
                  Gotówka: <span className={`font-semibold ${Math.abs(pnl.cashDiffTotal) < 0.01 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{fmt2(pnl.cashDiffTotal)}</span>
                  {'  ·  '}Drobne: {fmt2(pnl.pettySum)}{'  ·  '}Straty: {fmt2(pnl.lossesSum)}{'  ·  '}Zwroty: {fmt2(pnl.refundsSum)}
                </p>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Alerty</p>
                  {alerts.length === 0 ? <CheckCircle className="w-3.5 h-3.5 text-[#16A34A]" /> : <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />}
                </div>
                {alerts.length === 0 ? (
                  <p className="text-[13px] text-[#6B7280]">Brak alertów</p>
                ) : (
                  alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[#374151] mb-1">
                      <AlertTriangle className="w-3 h-3 text-[#F59E0B] mt-0.5 shrink-0" />{a}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  NOTIFICATIONS                                         */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'notifications' && (
          <div className="space-y-5">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Powiadomienia</h1>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              {notifications.length === 0 ? (
                <p className="text-center text-[#6B7280] py-12 text-[13px]">Brak powiadomień</p>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {notifications.map(notif => {
                    const Icon = NOTIFICATION_ICONS[notif.type] || Bell
                    const isUnread = notif.status === 'unread'
                    return (
                      <div key={notif.id} className={`flex items-start gap-4 px-5 py-4 ${isUnread ? 'bg-[#EFF6FF]' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUnread ? 'bg-[#DBEAFE]' : 'bg-[#F3F4F6]'}`}>
                          <Icon className={`w-4 h-4 ${isUnread ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-semibold ${isUnread ? 'text-[#111827]' : 'text-[#374151]'}`}>{notif.title}</p>
                          <p className="text-[12px] text-[#6B7280] mt-0.5">{notif.message}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-1">{notif.location_name} · {new Date(notif.created_at).toLocaleString('pl-PL')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isUnread && (
                            <button onClick={() => markNotificationRead(notif.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => {
                            markNotificationRead(notif.id)
                            if (notif.type === 'daily_report') setActiveView('daily_reports')
                            else if (notif.type === 'invoice') setActiveView('approvals')
                            else if (notif.type === 'inventory') setActiveView('inv_approvals')
                            else if (notif.type === 'semis_reconciliation') setActiveView('semis_verification')
                            else setActiveView('notifications')
                          }} className="h-7 px-2.5 flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
                            <ExternalLink className="w-3 h-3" />Przejdź
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E5E7EB]">
                  <p className="text-[13px] font-semibold text-[#111827]">Alerty systemowe</p>
                </div>
                <div className="px-5 py-4">
                  {dbAlerts.length === 0 ? (
                    <p className="text-[13px] text-[#6B7280] text-center py-4">Brak alertów z bazy</p>
                  ) : (
                    <div className="space-y-2">
                      {dbAlerts.map(a => (
                        <div key={a.id} className="flex items-start justify-between gap-3 p-3 border border-[#E5E7EB] rounded-lg">
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827]">{a.title}</p>
                            <p className="text-[12px] text-[#6B7280] mt-0.5">{a.message}</p>
                            <p className="text-[11px] text-[#9CA3AF] mt-1">{a.location_id || 'global'} · {new Date(a.created_at).toLocaleString('pl-PL')}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[11px] text-[#9CA3AF]">{a.status}</span>
                            <div className="flex gap-1.5">
                              {a.status === 'unread' && <button onClick={() => markAlertStatus(a.id, 'read')} className="h-6 px-2 text-[11px] font-medium rounded border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]">Przeczytano</button>}
                              <button onClick={() => markAlertStatus(a.id, 'actioned')} className="h-6 px-2 text-[11px] font-medium rounded bg-[#111827] text-white hover:bg-[#1F2937]">Podjęto</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#111827]">Transakcje magazynowe</p>
                  <button onClick={() => fetchPendingInvTxs()} className="h-6 px-2 text-[11px] font-medium rounded border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]">Odśwież</button>
                </div>
                <div className="px-5 py-4">
                  {pendingInvTxs.length === 0 ? (
                    <p className="text-[13px] text-[#6B7280] text-center py-4">Brak ostatnich transakcji</p>
                  ) : (
                    <div className="overflow-auto max-h-80">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#F3F4F6]">
                            <th className="pb-2 pr-2">Składnik</th><th className="pr-2">Ilość</th><th className="pr-2">Jedn.</th><th className="pr-2">Cena</th><th className="pr-2">Lokal</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingInvTxs.map(tx => (
                            <tr key={tx.id} className="border-b border-[#F3F4F6]">
                              <td className="py-2 pr-2 font-medium text-[#111827]">{tx.ingredients?.name || tx.ingredient_id}</td>
                              <td className="pr-2 text-[#374151]">{tx.quantity}</td>
                              <td className="pr-2 text-[#374151]">{tx.unit}</td>
                              <td className="pr-2 text-[#374151]">{tx.price || '—'}</td>
                              <td className="pr-2 text-[#6B7280]">{tx.location_id || '—'}</td>
                              <td className="text-right"><button onClick={() => createInvNotification(tx)} className="h-6 px-2 text-[11px] font-medium rounded bg-[#111827] text-white hover:bg-[#1F2937]">Review</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DAILY REPORTS LIST                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'daily_reports' && (
          <div className="space-y-5">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Raporty dzienne</h1>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              {pendingDailyReports.length === 0 ? (
                <p className="text-center text-[#6B7280] py-12 text-[13px]">Brak raportów do zatwierdzenia</p>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {pendingDailyReports.map(report => {
                    const net = Number(report.net_revenue) || (Number(report.gross_revenue) || 0) / (1 + VAT_RATE)
                    const laborCost = (Number(report.total_labor_hours) || 0) * (Number(report.avg_hourly_rate) || 0)
                    const laborPct = net > 0 ? laborCost / net : 0
                    return (
                      <div key={report.id}
                        className="flex items-center justify-between px-5 py-4 hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                        onClick={() => openDailyReportDetail(report)}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-[#2563EB]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827]">{report.location_name}</p>
                            <p className="text-[12px] text-[#6B7280]">{report.date} · {report.closing_person}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[14px] font-bold text-[#111827]">{fmt0(net)}</p>
                            <p className="text-[11px] text-[#9CA3AF]">Netto</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-[14px] font-bold ${laborPct > 0.3 ? 'text-[#DC2626]' : 'text-[#111827]'}`}>{fmtPct(laborPct)}</p>
                            <p className="text-[11px] text-[#9CA3AF]">Praca</p>
                          </div>
                          {Math.abs(Number(report.cash_diff) || 0) > 0.01 && (
                            <div className="text-right">
                              <p className="text-[14px] font-bold text-[#DC2626]">{fmt2(Number(report.cash_diff) || 0)}</p>
                              <p className="text-[11px] text-[#9CA3AF]">Różn. gotówki</p>
                            </div>
                          )}
                          <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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
          <div className="max-w-2xl">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Raport P&L</h1>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              {/* Revenue */}
              <div className="px-6 pt-5 pb-4 border-b border-[#E5E7EB]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Przychody</p>
                <div className="flex justify-between items-baseline py-2">
                  <span className="text-[14px] font-semibold text-[#111827]">Sprzedaż netto</span>
                  <span className="text-[20px] font-bold text-[#111827] font-mono">{fmt0(pnl.netSales)}</span>
                </div>
                <div className="flex justify-between items-baseline py-1">
                  <span className="text-[13px] text-[#6B7280]">Brutto (z VAT)</span>
                  <span className="text-[13px] text-[#6B7280] font-mono">{fmt0(pnl.grossSales)}</span>
                </div>
              </div>
              {/* Costs */}
              <div className="px-6 pt-5 pb-4 border-b border-[#E5E7EB]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Koszty</p>
                {[
                  ['COGS', pnl.cogs, pnl.cogsPercent],
                  ['Koszt pracy', pnl.laborCost, pnl.laborPercent],
                  ['OPEX', pnl.opex, pnl.netSales > 0 ? pnl.opex / pnl.netSales : 0],
                ].map(([l, v, p], i) => (
                  <div key={i} className="flex justify-between items-baseline py-2.5 border-b border-[#F3F4F6] last:border-0">
                    <span className="text-[13px] text-[#374151]">{l as string}</span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[12px] text-[#9CA3AF]">{fmtPct(p as number)}</span>
                      <span className="text-[14px] font-semibold text-[#111827] font-mono w-28 text-right">{fmt0(v as number)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-baseline pt-3 mt-1">
                  <span className="text-[13px] font-semibold text-[#374151]">Suma kosztów</span>
                  <span className="text-[16px] font-bold text-[#111827] font-mono">{fmt0(pnl.totalCosts)}</span>
                </div>
              </div>
              {/* Result */}
              <div className="px-6 pt-5 pb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Wynik</p>
                <div className="flex justify-between items-baseline py-2">
                  <span className="text-[15px] font-bold text-[#111827]">EBIT</span>
                  <span className={`text-[26px] font-bold font-mono ${pnl.operatingProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{fmt0(pnl.operatingProfit)}</span>
                </div>
                <div className="flex justify-between items-baseline py-1">
                  <span className="text-[13px] text-[#6B7280]">Marża netto</span>
                  <span className={`text-[15px] font-bold ${pnl.netMargin >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{fmtPct(pnl.netMargin)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INVOICE APPROVALS                                     */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'approvals' && (
          <div className="space-y-5">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Faktury do zatwierdzenia</h1>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              {pendingInvoices.length === 0 ? (
                <p className="text-center text-[#6B7280] py-12 text-[13px]">Brak faktur do zatwierdzenia</p>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {pendingInvoices.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center px-5 py-4">
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827]">{inv.supplier_name}</p>
                        <p className="text-[12px] text-[#6B7280] mt-0.5">{inv.locations?.name} · {inv.service_date} · {fmt0(inv.total_amount || inv.total_net || 0)}</p>
                        {inv.invoice_number && <p className="text-[11px] text-[#9CA3AF] mt-0.5">Nr: {inv.invoice_number} | {inv.invoice_type || '—'}</p>}
                        {inv.attachment_url && (
                          <a href={inv.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-[#2563EB] text-[11px] mt-1 font-medium hover:underline">
                            <ImageIcon className="w-3 h-3 mr-1" />Zobacz zdjęcie
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => updateInvoiceStatus(inv.id, 'declined')} disabled={loading}
                          className="h-8 px-3 text-[12px] font-medium rounded-lg border border-[#E5E7EB] text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors">
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Odrzuć'}
                        </button>
                        <button onClick={() => updateInvoiceStatus(inv.id, 'approved')} disabled={loading}
                          className="h-8 px-3 text-[12px] font-medium rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] disabled:opacity-50 transition-colors">
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Zatwierdź'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  SEMIS VERIFICATION                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'semis_verification' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Weryfikacja SEMIS</h1>
                <p className="text-[13px] text-[#6B7280] mt-0.5">Pozycje wprowadzone przez operatorów do uzgodnienia z księgowością</p>
              </div>
              {pendingSemisEntries.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => verifySemisBatch('rejected')}
                    className="h-8 px-3 text-[12px] font-medium rounded-lg border border-[#E5E7EB] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />Odrzuć wszystkie
                  </button>
                  <button onClick={() => verifySemisBatch('verified')}
                    className="h-8 px-3 text-[12px] font-medium rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />Zatwierdź wszystkie
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              {semisLoading ? (
                <div className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#9CA3AF]" /></div>
              ) : pendingSemisEntries.length === 0 ? (
                <p className="text-center text-[#6B7280] py-12 text-[13px]">Brak pozycji do weryfikacji</p>
              ) : (
                <>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                        <th className="py-3 px-4">Lokalizacja</th>
                        <th className="pr-3">Nr faktury</th>
                        <th className="pr-3">Dostawca</th>
                        <th className="pr-3">Data</th>
                        <th className="pr-3">Konto</th>
                        <th className="pr-3 text-right">Kwota</th>
                        <th className="pr-3">Opis</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSemisEntries.map(entry => (
                        <tr key={entry.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                          <td className="py-3 px-4 font-semibold text-[#111827]">{entry.location_name}</td>
                          <td className="pr-3 text-[#374151]">{entry.invoice_number}</td>
                          <td className="pr-3 text-[#374151]">{entry.supplier || '—'}</td>
                          <td className="pr-3 text-[#6B7280]">{entry.invoice_date}</td>
                          <td className="pr-3 text-[#6B7280]">{entry.accounting_account || '—'}</td>
                          <td className="pr-3 text-right font-semibold text-[#111827]">{fmt2(entry.amount)}</td>
                          <td className="pr-3 text-[#6B7280] max-w-[140px] truncate">{entry.description || '—'}</td>
                          <td className="pr-4 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => verifySemisEntry(entry.id, 'rejected')}
                                className="h-6 w-6 flex items-center justify-center rounded text-[#DC2626] hover:bg-[#FEF2F2]">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => verifySemisEntry(entry.id, 'verified')}
                                className="h-6 w-6 flex items-center justify-center rounded text-[#16A34A] hover:bg-[#F0FDF4]">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-center px-4 py-3 bg-[#F9FAFB] border-t border-[#E5E7EB]">
                    <span className="text-[13px] font-semibold text-[#374151]">Suma:</span>
                    <span className="text-[16px] font-bold text-[#111827]">{fmt0(pendingSemisEntries.reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  EMPLOYEES                                             */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'employees' && (
          <EmployeesManager
            supabase={supabase}
            companyId={companyId}
            locations={locations}
            defaultLocationId={filterLocationId !== 'all' ? filterLocationId : locations[0]?.id}
          />
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INVENTORY PRODUCT MANAGEMENT                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'products' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Produkty magazynowe</h1>
              <button onClick={() => setShowAddProduct(!showAddProduct)}
                className="h-8 px-3 text-[12px] font-medium rounded-lg bg-[#111827] text-white hover:bg-[#1F2937] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Dodaj produkt
              </button>
            </div>
            {showAddProduct && (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Nowy produkt</p>
                <div className="grid grid-cols-5 gap-2">
                  <Input placeholder="Nazwa" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="h-8 text-[13px]" />
                  <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="h-8 rounded-lg border border-[#E5E7EB] px-2 text-[13px] bg-white">{UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select>
                  <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="h-8 rounded-lg border border-[#E5E7EB] px-2 text-[13px] bg-white">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  <Input type="number" placeholder="Cena" value={newProduct.last_price} onChange={e => setNewProduct({...newProduct, last_price: e.target.value})} className="h-8 text-[13px]" />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[12px] text-[#374151]"><input type="checkbox" checked={newProduct.is_food} onChange={e => setNewProduct({...newProduct, is_food: e.target.checked})} className="w-3.5 h-3.5" />Spożywczy</label>
                    <button onClick={saveNewProduct} disabled={productSaving} className="h-8 px-3 rounded-lg bg-[#2563EB] text-white text-[12px] font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-1">
                      <Save className="w-3 h-3" />Zapisz
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB] flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-[#9CA3AF]" />
                  <Input placeholder="Szukaj produktu…" value={productSearch} onChange={e => setProductSearch(e.target.value)} className="h-7 pl-8 text-[12px]" />
                </div>
                <select value={productCategoryFilter} onChange={e => setProductCategoryFilter(e.target.value)} className="h-7 rounded-lg border border-[#E5E7EB] px-2 text-[12px] bg-white">
                  <option value="">Wszystkie kategorie</option>{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="py-2.5 px-4">Nazwa</th><th className="pr-3">Kat.</th><th className="pr-3">Jedn.</th><th className="pr-3 text-right">Cena</th><th className="pr-3">Spoż.</th><th className="pr-3">Aktywny</th><th className="pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} className={`border-b border-[#F3F4F6] hover:bg-[#F9FAFB] ${!p.active ? 'opacity-50' : ''}`}>
                      {editingProduct?.id === p.id ? (<>
                        <td className="py-2 px-4"><Input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="h-7 text-[12px]" /></td>
                        <td className="pr-3"><select value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="h-7 rounded border border-[#E5E7EB] px-1 text-[12px]">{PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                        <td className="pr-3"><select value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} className="h-7 rounded border border-[#E5E7EB] px-1 text-[12px]">{UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></td>
                        <td className="pr-3"><Input type="number" value={editingProduct.last_price} onChange={e => setEditingProduct({...editingProduct, last_price: Number(e.target.value)})} className="h-7 w-20 text-right text-[12px]" /></td>
                        <td className="pr-3"><input type="checkbox" checked={editingProduct.is_food} onChange={e => setEditingProduct({...editingProduct, is_food: e.target.checked})} /></td>
                        <td className="pr-3">{p.active ? 'Tak' : 'Nie'}</td>
                        <td className="pr-4 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => updateProduct(editingProduct)} className="h-6 w-6 flex items-center justify-center rounded text-[#16A34A] hover:bg-[#F0FDF4]"><Save className="w-3 h-3" /></button>
                            <button onClick={() => setEditingProduct(null)} className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"><XCircle className="w-3 h-3" /></button>
                            <button onClick={() => deleteProduct(p.id)} className="h-6 w-6 flex items-center justify-center rounded text-[#DC2626] hover:bg-[#FEF2F2]"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </>) : (<>
                        <td className="py-2.5 px-4 font-semibold text-[#111827]">{p.name}</td>
                        <td className="pr-3 text-[#6B7280]">{p.category}</td>
                        <td className="pr-3 text-[#6B7280]">{p.unit}</td>
                        <td className="pr-3 text-right font-medium text-[#111827]">{fmt2(p.last_price)}</td>
                        <td className="pr-3 text-[#6B7280]">{p.is_food ? 'Tak' : 'Nie'}</td>
                        <td className="pr-3">
                          <button onClick={() => toggleProductActive(p.id, p.active)}>
                            {p.active ? <ToggleRight className="w-5 h-5 text-[#16A34A]" /> : <ToggleLeft className="w-5 h-5 text-[#9CA3AF]" />}
                          </button>
                        </td>
                        <td className="pr-4 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => setEditingProduct({...p})} className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => deleteProduct(p.id)} className="h-6 w-6 flex items-center justify-center rounded text-[#DC2626] hover:bg-[#FEF2F2]"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  INGREDIENTS MANAGEMENT                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'ingredients' && (
          <IngredientsSection supabase={supabase} companyId={companyId} />
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  DISHES & RECIPES MANAGEMENT                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'dishes' && (
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Dania i receptury</h1>
            <DishesManager supabase={supabase} companyId={companyId} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  MONTHLY GENERATOR                                     */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'monthly' && (
          <div><h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Generator inwentaryzacji miesięcznej</h1>
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
          <div className="space-y-5">
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Raporty zbiorcze</h1>
            {!reportType ? (
              <>
                <div className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-lg px-4 py-3">
                  <span className="text-[13px] font-medium text-[#374151]">Od:</span>
                  <Input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} className="h-7 w-36 text-[13px]" />
                  <span className="text-[13px] font-medium text-[#374151]">Do:</span>
                  <Input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} className="h-7 w-36 text-[13px]" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { t: 'daily_all', i: BarChart3, l: 'Sprzedaż wg lokalizacji', d: 'Netto, transakcje, praca' },
                    { t: 'cogs_all', i: TrendingUp, l: 'COGS i marża', d: 'Zakupy vs przychody' },
                    { t: 'labor_all', i: Clock, l: 'Praca wg lokalizacji', d: 'Godziny, koszt, efektywność' },
                    { t: 'inventory_all', i: ClipboardList, l: 'Inwentaryzacje', d: 'Odchylenia i wartości' },
                    { t: 'semis_all', i: Receipt, l: 'Koszty SEMIS', d: 'Wg kategorii i lokalizacji' },
                  ].map(({ t, i: Icon, l, d }) => (
                    <button key={t} onClick={() => generateReport(t)}
                      className="bg-white border border-[#E5E7EB] rounded-lg p-5 text-left hover:border-[#2563EB] transition-all group">
                      <Icon className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#2563EB] mb-3" />
                      <p className="text-[13px] font-semibold text-[#111827]">{l}</p>
                      <p className="text-[12px] text-[#6B7280] mt-0.5">{d}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-5">
                <button onClick={() => { setReportType(null); setReportData(null) }}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />Powrót
                </button>
                {reportLoading ? (
                  <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#9CA3AF]" /></div>
                ) : reportData && (
                  <>
                    {reportType === 'daily_all' && (
                      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                        <div className="px-5 py-3 border-b border-[#E5E7EB]"><p className="text-[13px] font-semibold text-[#111827]">Sprzedaż wg lokalizacji</p></div>
                        <table className="w-full text-[12px]">
                          <thead><tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                            <th className="py-2.5 px-4 text-left">Lokalizacja</th><th className="pr-3 text-right">Netto</th><th className="pr-3 text-right">Brutto</th><th className="pr-3 text-right">Tx</th><th className="pr-3 text-right">Praca</th><th className="pr-3 text-right">Praca %</th><th className="pr-4 text-right">Dni</th>
                          </tr></thead>
                          <tbody>{reportData.byLocation?.map((l: any, i: number) => (
                            <tr key={i} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                              <td className="py-2.5 px-4 font-semibold text-[#111827]">{l.name}</td>
                              <td className="pr-3 text-right text-[#374151]">{fmt0(l.netSales)}</td><td className="pr-3 text-right text-[#374151]">{fmt0(l.grossSales)}</td>
                              <td className="pr-3 text-right text-[#374151]">{l.tx}</td><td className="pr-3 text-right text-[#374151]">{fmt0(l.laborCost)}</td>
                              <td className={`pr-3 text-right font-bold ${l.netSales > 0 && l.laborCost / l.netSales > 0.3 ? 'text-[#DC2626]' : 'text-[#374151]'}`}>{l.netSales > 0 ? fmtPct(l.laborCost / l.netSales) : '—'}</td>
                              <td className="pr-4 text-right text-[#374151]">{l.days}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                    {reportType === 'cogs_all' && (
                      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                        <div className="px-5 py-3 border-b border-[#E5E7EB]"><p className="text-[13px] font-semibold text-[#111827]">COGS i marża</p></div>
                        <table className="w-full text-[12px]">
                          <thead><tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                            <th className="py-2.5 px-4 text-left">Lokalizacja</th><th className="pr-3 text-right">Netto</th><th className="pr-3 text-right">Zakupy COS</th><th className="pr-3 text-right">Marża</th><th className="pr-4 text-right">Marża %</th>
                          </tr></thead>
                          <tbody>{reportData.locations?.map((l: any, i: number) => (
                            <tr key={i} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                              <td className="py-2.5 px-4 font-semibold text-[#111827]">{l.name}</td><td className="pr-3 text-right text-[#374151]">{fmt0(l.totalNet)}</td>
                              <td className="pr-3 text-right text-[#374151]">{fmt0(l.totalPurchases)}</td><td className="pr-3 text-right text-[#374151]">{fmt0(l.margin)}</td>
                              <td className={`pr-4 text-right font-bold ${l.marginPct < 0.6 ? 'text-[#F59E0B]' : 'text-[#16A34A]'}`}>{fmtPct(l.marginPct)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                    {reportType === 'labor_all' && (
                      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
                        <div className="px-5 py-3 border-b border-[#E5E7EB]"><p className="text-[13px] font-semibold text-[#111827]">Praca wg lokalizacji</p></div>
                        <table className="w-full text-[12px]">
                          <thead><tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                            <th className="py-2.5 px-4 text-left">Lokalizacja</th><th className="pr-3 text-right">Netto</th><th className="pr-3 text-right">Godz.</th><th className="pr-3 text-right">Koszt</th><th className="pr-3 text-right">%</th><th className="pr-4 text-right">Netto/h</th>
                          </tr></thead>
                          <tbody>{reportData.locations?.map((l: any, i: number) => (
                            <tr key={i} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                              <td className="py-2.5 px-4 font-semibold text-[#111827]">{l.name}</td><td className="pr-3 text-right text-[#374151]">{fmt0(l.netSales)}</td>
                              <td className="pr-3 text-right text-[#374151]">{l.hours.toFixed(1)}</td><td className="pr-3 text-right text-[#374151]">{fmt0(l.cost)}</td>
                              <td className={`pr-3 text-right font-bold ${l.pct > 0.3 ? 'text-[#DC2626]' : 'text-[#374151]'}`}>{fmtPct(l.pct)}</td>
                              <td className="pr-4 text-right text-[#374151]">{fmt2(l.sph)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    )}
                    {reportType === 'inventory_all' && (
                      <div className="space-y-3">
                        <p className="text-[13px] font-semibold text-[#111827]">Inwentaryzacje</p>
                        {reportData.jobs?.length === 0 ? <p className="text-center text-[#6B7280] py-8 text-[13px]">Brak</p> :
                          reportData.jobs?.map((j: any, i: number) => {
                            const items = j.inventory_job_items || []
                            const wd = items.filter((it: any) => it.expected_qty != null && it.counted_qty != null && Math.abs(it.counted_qty - it.expected_qty) > 0.01)
                            return (
                              <div key={i} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                  <div>
                                    <p className="text-[13px] font-semibold text-[#111827]">{j.location_name}</p>
                                    <p className="text-[12px] text-[#6B7280]">{j.type} · {j.due_date}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[12px] text-[#6B7280]">{items.length} poz.</p>
                                    <p className={`text-[13px] font-bold ${wd.length > 0 ? 'text-[#F59E0B]' : 'text-[#16A34A]'}`}>{wd.length} odchyleń</p>
                                  </div>
                                </div>
                                {wd.slice(0, 5).map((it: any, k: number) => {
                                  const d = (it.counted_qty || 0) - (it.expected_qty || 0)
                                  return (
                                    <div key={k} className="flex justify-between text-[11px] border-t border-[#F3F4F6] py-1">
                                      <span className="text-[#374151]">{it.inventory_products?.name}</span>
                                      <span className={d < 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}>{d > 0 ? '+' : ''}{d.toFixed(1)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                      </div>
                    )}
                    {reportType === 'semis_all' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Wg kategorii</p>
                            {reportData.byCategory?.map((c: any, i: number) => (
                              <div key={i} className="flex justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                                <span className="text-[13px] text-[#374151]">{SEMIS_CATEGORIES[c.category] || c.category}</span>
                                <span className="text-[13px] font-semibold text-[#111827]">{fmt0(c.amount)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-3">Wg lokalizacji</p>
                            {reportData.byLocation?.map((l: any, i: number) => (
                              <div key={i} className="flex justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                                <span className="text-[13px] text-[#374151]">{l.location}</span>
                                <span className="text-[13px] font-semibold text-[#111827]">{fmt0(l.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Suma SEMIS</p>
                          <p className="text-[28px] font-bold text-[#111827] mt-1">{fmt0(reportData.total || 0)}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  HISTORY                                               */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'history' && (
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Historia operacji</h1>
            
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
          <div><h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Dane z Excela</h1>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <table className="w-full text-[12px]"><thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]"><tr className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
                <th className="py-3 px-4 text-left">Data</th><th className="pr-3 text-left">Lokal</th><th className="pr-3 text-left">Dostawca</th>
                <th className="pr-3 text-left">Opis</th><th className="pr-3 text-left">Typ</th><th className="pr-4 text-right">Kwota</th>
              </tr></thead><tbody>
                {importedCosts.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[#6B7280]">Brak danych</td></tr>}
                {importedCosts.map((item, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]"><td className="py-2.5 px-4 text-[#6B7280]">{item.cost_date}</td><td className="pr-3 font-semibold text-[#111827]">{item.locations?.name}</td>
                    <td className="pr-3 text-[#374151]">{item.supplier}</td><td className="pr-3 text-[#6B7280] truncate max-w-[200px]">{item.account_description}</td>
                    <td className="pr-3"><span className="bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[11px] text-[#374151]">{item.cost_type}</span></td>
                    <td className="pr-4 text-right font-mono font-medium text-[#111827]">{item.amount} zł</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  MENU PRICING CALCULATOR                               */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'menu_calculator' && (
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Kalkulator Ceny Menu</h1>
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <Label className="text-sm">Wybierz danie</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input px-3 text-sm"
                      value={selectedCalcDishId}
                      onChange={(e) => setSelectedCalcDishId(e.target.value)}
                    >
                      {menuCalcDishes.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Button variant="outline" onClick={fetchMenuCalcDishes} disabled={menuCalcLoading}>
                      {menuCalcLoading ? 'Ładowanie…' : 'Odśwież'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(() => {
              const dish = menuCalcDishes.find(d => d.id === selectedCalcDishId)
              if (!dish) {
                return <div className="text-sm text-slate-500">Brak dań do wyceny.</div>
              }
              
              const menuPriceGross = dish.menuPriceGross ?? 0
              const menuPriceNet = dish.menuPriceNet ?? 0
              const marginTarget = dish.marginTarget ?? 0.7
              const foodCostTarget = dish.foodCostTarget ?? 0.3
              const currentMarginPct = menuPriceGross > 0 ? ((menuPriceGross - dish.foodCost) / menuPriceGross) * 100 : 0
              const currentFoodCostPct = menuPriceGross > 0 ? (dish.foodCost / menuPriceGross) * 100 : 0
              const marginTargetPct = marginTarget * 100
              const foodCostTargetPct = foodCostTarget * 100
              
              return (
                <>
                  <Card className="mb-4 bg-slate-50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="border-l-4 border-blue-500 pl-3">
                          <div className="text-xs text-slate-600">Koszt produkcji</div>
                          <div className="text-lg font-bold text-blue-600">{dish.foodCost.toFixed(2)} zł</div>
                        </div>
                        <div className="border-l-4 border-green-500 pl-3">
                          <div className="text-xs text-slate-600">Obecna cena netto</div>
                          <div className="text-lg font-bold text-green-600">{menuPriceNet.toFixed(2)} zł</div>
                        </div>
                        <div className="border-l-4 border-purple-500 pl-3">
                          <div className="text-xs text-slate-600">Obecna cena brutto</div>
                          <div className="text-lg font-bold text-purple-600">{menuPriceGross.toFixed(2)} zł</div>
                        </div>
                        <div className="border-l-4 border-orange-500 pl-3">
                          <div className="text-xs text-slate-600">VAT {dish.vatRate}%</div>
                          <div className="text-lg font-bold text-orange-600">{(menuPriceGross - menuPriceNet).toFixed(2)} zł</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                        <div>
                          <div className="text-xs text-slate-600 mb-2">Koszt produkcji %</div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold">{currentFoodCostPct.toFixed(1)}%</div>
                            <div className="text-xs text-slate-500">Cel: {foodCostTargetPct.toFixed(0)}%</div>
                          </div>
                          <div className={`text-xs mt-1 ${currentFoodCostPct <= foodCostTargetPct ? 'text-green-600' : currentFoodCostPct <= foodCostTargetPct + 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {currentFoodCostPct <= foodCostTargetPct ? '✓ OK' : currentFoodCostPct <= foodCostTargetPct + 5 ? '⚠ Ostrzeżenie' : '✗ Przekroczenie'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-slate-600 mb-2">Marża %</div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold">{currentMarginPct.toFixed(1)}%</div>
                            <div className="text-xs text-slate-500">Cel: {marginTargetPct.toFixed(0)}%</div>
                          </div>
                          <div className={`text-xs mt-1 ${currentMarginPct >= marginTargetPct ? 'text-green-600' : 'text-red-600'}`}>
                            {currentMarginPct >= marginTargetPct ? '✓ OK' : '✗ Za niska'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-slate-600 mb-2">Status</div>
                          <div className="text-sm font-semibold capitalize">
                            {dish.status === 'active' && <span className="text-green-600">Aktywne</span>}
                            {dish.status === 'inactive' && <span className="text-slate-600">Nieaktywne</span>}
                            {dish.status === 'draft' && <span className="text-yellow-600">Szkic</span>}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-slate-600 mb-2">Marża jednostkowa</div>
                          <div className="text-sm font-semibold text-blue-600">
                            {(menuPriceGross - dish.foodCost).toFixed(2)} zł
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <MenuPriceCalculator
                    dishName={dish.name}
                    foodCost={dish.foodCost}
                    defaultMarginTarget={marginTarget}
                    vatRate={dish.vatRate}
                    saving={menuCalcSaving}
                    onSavePrice={(price, marginTargetValue) =>
                      saveMenuCalcPrice(dish.id, price, marginTargetValue, dish.vatRate)
                    }
                  />
                </>
              )
            })()}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  MENU PRICING TABLE                                    */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'menu_pricing' && (
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Przegląd wyceny menu</h1>
            <Button
              variant="outline"
              size="sm"
              className="mb-4"
              onClick={fetchMenuPricingDishes}
              disabled={menuPricingLoading}
            >
              {menuPricingLoading ? 'Ładowanie…' : 'Odśwież dane'}
            </Button>
            <MenuPricingTable dishes={menuPricingDishes.length ? menuPricingDishes : undefined} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  WAREHOUSE DEVIATION REPORT                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'warehouse_deviations' && (
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Raport odchyleń magazynu</h1>
            <WarehouseDeviationReport />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/*  CENTRAL WAREHOUSE PANEL                               */}
        {/* ═══════════════════════════════════════════════════════ */}
        {activeView === 'central_warehouse' && (
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight mb-6">Magazyn centralny</h1>
            <CentralWarehousePanel companyId={companyId} />
          </div>
        )}
      </main>
    </div>
  )
}