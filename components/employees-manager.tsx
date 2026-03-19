'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Plus, Upload, Save, Trash2, Edit2, X, Loader2, Mail, MapPin, DollarSign, CheckCircle2, XCircle, AlertCircle, Users, Phone, Briefcase } from 'lucide-react'

const POSITIONS = ['kucharz','kelner','kasjer','manager','zmywak','barista','dostawa','inne']

type LocationRow = { id: string; name: string }

type Employee = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  position: string | null
  status: string
  real_hour_cost: number | null
  base_rate: number | null
  user_id: string | null
  location_id: string | null
  locations?: { name: string } | null
}

type AuthStatus = { id: string; confirmed_at: string | null; last_sign_in: string | null }

type ParsedEmployee = {
  full_name: string; email: string; location_name: string; hourly_cost: string
}

type ImportResult = { email: string; status: 'invited' | 'exists' | 'error'; message?: string }

const COLUMN_ALIASES: Record<string, string> = {
  'imię i nazwisko': 'full_name', 'imie i nazwisko': 'full_name',
  'name': 'full_name', 'nazwa': 'full_name', 'pracownik': 'full_name',
  'mail': 'email', 'e-mail': 'email',
  'lokalizacja': 'location_name', 'location': 'location_name', 'miejsce': 'location_name',
  'stawka': 'hourly_cost', 'stawka godzinowa': 'hourly_cost',
  'hourly_rate': 'hourly_cost', 'koszt': 'hourly_cost',
}
const normalizeHeader = (h: string) => { const l = h.trim().toLowerCase(); return COLUMN_ALIASES[l] ?? l }

export function EmployeesManager({
  supabase,
  companyId,
  locations,
  defaultLocationId,
}: {
  supabase: SupabaseClient
  companyId: string
  locations: LocationRow[]
  defaultLocationId?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── state ──
  const [employees, setEmployees]         = useState<Employee[]>([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState<'list' | 'add' | 'csv'>('list')
  const [filterLoc, setFilterLoc]         = useState<string>('all')

  // manual add
  const [form, setForm]                   = useState({ full_name: '', email: '', phone: '', position: '', location_id: defaultLocationId ?? locations[0]?.id ?? '', hourly_cost: '' })
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState('')

  // edit
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editForm, setEditForm]           = useState<Partial<Employee>>({})
  const [editSaving, setEditSaving]       = useState(false)

  // auth status map (user_id → confirmed/last_sign_in)
  const [authStatus, setAuthStatus]       = useState<Record<string, AuthStatus>>({})

  // csv
  const [parsed, setParsed]               = useState<ParsedEmployee[]>([])
  const [parseError, setParseError]       = useState('')
  const [importing, setImporting]         = useState(false)
  const [results, setResults]             = useState<ImportResult[]>([])
  const [dragging, setDragging]           = useState(false)

  // ── fetch ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('employees')
      .select('id, full_name, email, phone, position, status, real_hour_cost, base_rate, user_id, location_id, locations(name)')
      .order('full_name')
    if (filterLoc !== 'all') q = q.eq('location_id', filterLoc)
    const { data } = await q
    const emps = (data as unknown as Employee[]) ?? []
    setEmployees(emps)

    // Load auth status for employees who have a user_id
    const ids = emps.map(e => e.user_id).filter(Boolean) as string[]
    if (ids.length) {
      try {
        const res = await fetch(`/api/admin/employee-auth-status?user_ids=${ids.join(',')}`)
        const json = await res.json()
        const map: Record<string, AuthStatus> = {}
        ;(json.users ?? []).forEach((u: AuthStatus) => { map[u.id] = u })
        setAuthStatus(map)
      } catch { /* non-critical */ }
    }
    setLoading(false)
  }, [supabase, filterLoc])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  // ── manual add ──
  const handleAdd = async () => {
    if (!form.full_name.trim()) { setSaveMsg('Podaj imię i nazwisko'); return }
    setSaving(true); setSaveMsg('')
    const { error } = await supabase.from('employees').insert({
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      position: form.position || null,
      location_id: form.location_id || null,
      base_rate: form.hourly_cost ? parseFloat(form.hourly_cost) : null,
      real_hour_cost: form.hourly_cost ? parseFloat(form.hourly_cost) : null,
      status: 'active',
    })
    if (error) { setSaveMsg('Błąd: ' + error.message); setSaving(false); return }
    setForm({ full_name: '', email: '', phone: '', position: '', location_id: form.location_id, hourly_cost: '' })
    setSaveMsg('✓ Dodano')
    setTimeout(() => setSaveMsg(''), 3000)
    fetchEmployees()
    setTab('list')
    setSaving(false)
  }

  // ── edit ──
  const startEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setEditForm({ full_name: emp.full_name, email: emp.email ?? '', phone: emp.phone ?? '', position: emp.position ?? '', location_id: emp.location_id ?? '', real_hour_cost: emp.real_hour_cost, base_rate: emp.base_rate, status: emp.status })
  }
  const cancelEdit = () => { setEditingId(null); setEditForm({}) }
  const saveEdit = async (id: string) => {
    setEditSaving(true)
    await supabase.from('employees').update({
      full_name: editForm.full_name,
      email: editForm.email || null,
      phone: (editForm as any).phone || null,
      position: (editForm as any).position || null,
      location_id: editForm.location_id || null,
      base_rate: editForm.base_rate ?? null,
      real_hour_cost: editForm.real_hour_cost,
      status: editForm.status,
    }).eq('id', id)
    setEditingId(null)
    setEditSaving(false)
    fetchEmployees()
  }
  const deleteEmployee = async (id: string) => {
    if (!confirm('Usunąć tego pracownika?')) return
    await supabase.from('employees').delete().eq('id', id)
    fetchEmployees()
  }

  // ── csv parse ──
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) { setParseError('Plik musi zawierać nagłówki i dane.'); return }
    const headers = lines[0].split(',').map(normalizeHeader)
    if (!headers.includes('full_name') || !headers.includes('email')) {
      setParseError('Brakuje kolumn: full_name i email'); return
    }
    const rows: ParsedEmployee[] = []
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = cells[idx] ?? '' })
      if (!row.email || !row.full_name) continue
      rows.push({ full_name: row.full_name, email: row.email, location_name: row.location_name ?? '', hourly_cost: row.hourly_cost ?? '' })
    }
    if (!rows.length) { setParseError('Brak wierszy z danymi.'); return }
    setParseError(''); setParsed(rows); setResults([])
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { setParseError('Wybierz plik .csv'); return }
    const reader = new FileReader()
    reader.onload = e => parseCSV(e.target?.result as string)
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    if (!parsed.length) return
    setImporting(true)
    try {
      const res = await fetch('/api/admin/import-employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: parsed.map(e => ({ full_name: e.full_name, email: e.email, location_name: e.location_name || undefined, hourly_cost: e.hourly_cost ? parseFloat(e.hourly_cost) : null })) })
      })
      const data = await res.json()
      if (data.results) { setResults(data.results); setParsed([]); fetchEmployees(); setTab('list') }
      else setParseError(data.error ?? 'Błąd importu')
    } catch { setParseError('Błąd połączenia') }
    setImporting(false)
  }

  const successCount = results.filter(r => r.status !== 'error').length

  // ── render ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[#111827] tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" /> Pracownicy
        </h1>
        <div className="flex items-center gap-2">
          {tab !== 'list' && (
            <button onClick={() => setTab('list')} className="h-8 px-3 text-[12px] font-medium rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-gray-50 flex items-center gap-1.5">
              <X className="w-3 h-3" /> Anuluj
            </button>
          )}
          {tab === 'list' && (
            <>
              <button onClick={() => setTab('add')} className="h-8 px-3 text-[12px] font-medium rounded-lg bg-[#111827] text-white hover:bg-[#1F2937] flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Dodaj ręcznie
              </button>
              <button onClick={() => { setTab('csv'); setParsed([]); setResults([]); setParseError('') }} className="h-8 px-3 text-[12px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Result banner */}
      {results.length > 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Zaimportowano {successCount} z {results.length} pracowników. Wysłano zaproszenia e-mail.
          <button className="ml-auto text-green-600 hover:text-green-900" onClick={() => setResults([])}>✕</button>
        </div>
      )}

      {/* ── ADD FORM ── */}
      {tab === 'add' && (
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-5 space-y-4">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Nowy pracownik</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Imię i nazwisko *</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jan Kowalski" className="w-full h-8 rounded-lg border border-[#E5E7EB] px-3 text-[13px] bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="jan@example.com" type="email" className="w-full h-8 rounded-lg border border-[#E5E7EB] px-3 text-[13px] bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Telefon</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+48 600 000 000" type="tel" className="w-full h-8 rounded-lg border border-[#E5E7EB] px-3 text-[13px] bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Stanowisko</label>
              <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                className="w-full h-8 rounded-lg border border-[#E5E7EB] px-3 text-[13px] bg-white text-gray-900 focus:outline-none focus:border-blue-400">
                <option value="">— wybierz —</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Lokalizacja</label>
              <select value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })}
                className="w-full h-8 rounded-lg border border-[#E5E7EB] px-3 text-[13px] bg-white text-gray-900 focus:outline-none focus:border-blue-400">
                <option value="">— brak —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#6B7280] mb-1 block">Stawka godzinowa (zł)</label>
              <input value={form.hourly_cost} onChange={e => setForm({ ...form, hourly_cost: e.target.value })}
                placeholder="0.00" type="number" min="0" step="0.5" className="w-full h-8 rounded-lg border border-[#E5E7EB] px-3 text-[13px] bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleAdd} disabled={saving} className="h-8 px-4 rounded-lg bg-[#2563EB] text-white text-[12px] font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Zapisz pracownika
            </button>
            {saveMsg && <span className="text-[12px] text-green-600">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* ── CSV IMPORT ── */}
      {tab === 'csv' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-[12px] font-semibold text-blue-800 mb-1.5">Format CSV:</p>
            <code className="text-[11px] text-blue-700 bg-blue-100 px-3 py-2 rounded block font-mono leading-relaxed">
              full_name,email,location_name,hourly_cost<br/>
              Jan Kowalski,jan@example.com,Warszawa Centrum,25.00
            </code>
            <p className="text-[11px] text-blue-600 mt-2">
              Po imporcie każdy pracownik otrzyma e-mail z zaproszeniem do aplikacji mobilnej.
            </p>
          </div>

          {!parsed.length ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-[#E5E7EB] bg-[#F9FAFB] hover:border-blue-400 hover:bg-blue-50/40'}`}
            >
              <Upload className="mx-auto mb-2 text-[#9CA3AF]" size={30} />
              <p className="text-[13px] font-semibold text-[#374151]">Przeciągnij plik CSV lub kliknij</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">Tylko pliki .csv (UTF-8)</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#374151]">Podgląd: {parsed.length} pracowników</p>
                <button onClick={() => setParsed([])} className="text-[11px] text-[#9CA3AF] hover:text-red-500">Wyczyść</button>
              </div>
              <table className="w-full text-[12px]">
                <thead className="bg-[#F9FAFB]">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] border-b border-[#E5E7EB]">
                    <th className="px-4 py-2.5">Imię i nazwisko</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Lokalizacja</th>
                    <th className="px-3 py-2.5">Stawka/h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {parsed.map((emp, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-medium text-[#111827]">{emp.full_name}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{emp.email}</td>
                      <td className="px-3 py-2.5 text-[#6B7280]">{emp.location_name || '—'}</td>
                      <td className="px-3 py-2.5 text-[#6B7280]">{emp.hourly_cost ? `${emp.hourly_cost} zł` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-[#E5E7EB]">
                <button onClick={handleImport} disabled={importing}
                  className="h-8 px-4 rounded-lg bg-[#2563EB] text-white text-[12px] font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-1.5">
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {importing ? 'Wysyłanie...' : `Importuj i wyślij zaproszenia (${parsed.length})`}
                </button>
              </div>
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-[12px] text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {parseError}
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEE LIST ── */}
      {tab === 'list' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
            <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
              className="h-7 rounded-lg border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none">
              <option value="all">Wszystkie lokalizacje</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <span className="text-[11px] text-[#9CA3AF] ml-auto">{employees.length} pracowników</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[#9CA3AF]" size={24} />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Users size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-medium">Brak pracowników</p>
              <p className="text-[11px] mt-1">Dodaj ręcznie lub zaimportuj CSV</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="px-4 py-2.5">Pracownik</th>
                  <th className="px-3 py-2.5">Stanowisko</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Telefon</th>
                  <th className="px-3 py-2.5">Lokalizacja</th>
                  <th className="px-3 py-2.5">Stawka/h</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Konto</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-[#F9FAFB]">
                    {editingId === emp.id ? (
                      <>
                        <td className="px-3 py-2">
                          <input value={editForm.full_name ?? ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                            className="w-full h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none focus:border-blue-400" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={(editForm as any).position ?? ''} onChange={e => setEditForm({ ...editForm, ...(({ position: e.target.value } as any)) })}
                            className="w-full h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none">
                            <option value="">— brak —</option>
                            {POSITIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input value={editForm.email ?? ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none focus:border-blue-400" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={(editForm as any).phone ?? ''} onChange={e => setEditForm({ ...editForm, ...({ phone: e.target.value } as any) })}
                            placeholder="+48..." className="w-full h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none focus:border-blue-400" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={editForm.location_id ?? ''} onChange={e => setEditForm({ ...editForm, location_id: e.target.value })}
                            className="w-full h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none">
                            <option value="">— brak —</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={editForm.base_rate ?? editForm.real_hour_cost ?? ''} onChange={e => { const v = parseFloat(e.target.value) || null; setEditForm({ ...editForm, base_rate: v, real_hour_cost: v }) }}
                            className="w-20 h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={editForm.status ?? 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                            className="h-7 rounded border border-[#E5E7EB] px-2 text-[12px] bg-white text-gray-900 focus:outline-none">
                            <option value="active">Aktywny</option>
                            <option value="inactive">Nieaktywny</option>
                          </select>
                        </td>
                        <td className="px-3 py-2"></td>
                        <td className="px-4 py-2 flex items-center gap-1.5">
                          <button onClick={() => saveEdit(emp.id)} disabled={editSaving}
                            className="h-7 px-2.5 rounded bg-[#2563EB] text-white text-[11px] font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-1">
                            {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Zapisz
                          </button>
                          <button onClick={cancelEdit} className="h-7 px-2 rounded border border-[#E5E7EB] text-[11px] text-[#374151] hover:bg-gray-50">
                            Anuluj
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-[#111827]">{emp.full_name}</td>
                        <td className="px-3 py-3">
                          {emp.position
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">{emp.position}</span>
                            : <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-3 py-3 text-[#6B7280]">
                          {emp.email
                            ? <a href={`mailto:${emp.email}`} className="flex items-center gap-1 hover:text-blue-600"><Mail className="w-3 h-3" />{emp.email}</a>
                            : <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-3 py-3 text-[#6B7280]">
                          {emp.phone
                            ? <a href={`tel:${emp.phone}`} className="flex items-center gap-1 hover:text-blue-600"><Phone className="w-3 h-3" />{emp.phone}</a>
                            : <span className="text-[#D1D5DB]">—</span>}
                        </td>
                        <td className="px-3 py-3 text-[#6B7280]">{emp.locations?.name ?? <span className="text-[#D1D5DB]">—</span>}</td>
                        <td className="px-3 py-3 text-[#6B7280]">{(emp.base_rate ?? emp.real_hour_cost) ? `${emp.base_rate ?? emp.real_hour_cost} zł` : <span className="text-[#D1D5DB]">—</span>}</td>
                        <td className="px-3 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}>
                            {emp.status === 'active' ? 'Aktywny' : 'Nieaktywny'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {!emp.user_id ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">
                              Brak konta
                            </span>
                          ) : authStatus[emp.user_id]?.confirmed_at ? (
                            <div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                                ✓ Aktywny
                              </span>
                              {authStatus[emp.user_id]?.last_sign_in && (
                                <p className="text-[9px] text-gray-400 mt-0.5">
                                  {new Date(authStatus[emp.user_id].last_sign_in!).toLocaleDateString('pl-PL')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700" title="Email zaproszenia wysłany, czeka na potwierdzenie">
                              📧 Zaproszony
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 flex items-center gap-1.5">
                          <button onClick={() => startEdit(emp)} className="h-7 w-7 rounded border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#2563EB] hover:border-blue-300">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteEmployee(emp.id)} className="h-7 w-7 rounded border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-red-500 hover:border-red-300">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
