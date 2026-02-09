'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../supabase-client'
import { Sidebar } from '@/components/Sidebar'

export default function FinancePage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    const fetchInvoices = async () => {
      const { data } = await supabase.from('invoices').select('*, locations(name)').order('service_date', { ascending: false })
      if (data) setInvoices(data)
    }
    fetchInvoices()
  }, [])

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Finance & Accounting</h1>
          <p className="text-slate-500">View all records and payment statuses.</p>
        </header>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-700 text-sm">Date</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Location</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Supplier</th>
                <th className="p-4 font-semibold text-slate-700 text-sm text-right">Amount</th>
                <th className="p-4 font-semibold text-slate-700 text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-600">{inv.service_date}</td>
                  <td className="p-4 text-slate-600">{inv.locations?.name}</td>
                  <td className="p-4 font-medium text-slate-900">{inv.supplier_name}</td>
                  <td className="p-4 text-right font-mono text-slate-900">${inv.total_amount}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}