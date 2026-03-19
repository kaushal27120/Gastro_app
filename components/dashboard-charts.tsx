'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

const PLN = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(v || 0)

export interface WeekDay {
  day: string
  date: string
  revenue: number
}

interface DashboardChartsProps {
  pnl: {
    netSales: number
    laborCost: number
    laborPercent: number
    cogs: number
    cogsPercent: number
    opex: number
    operatingProfit: number
    netMargin: number
    grossMarginPercent: number
  }
  weeklyData: WeekDay[]
}

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3 text-[12px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[#374151]">{p.name}:</span>
          <span className="font-bold text-[#111827]">{PLN(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3 text-[12px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.payload.color }} />
        <span className="text-[#374151]">{d.name}:</span>
        <span className="font-bold text-[#111827]">{PLN(d.value)}</span>
      </div>
    </div>
  )
}

export function DashboardCharts({ pnl, weeklyData }: DashboardChartsProps) {
  const breakdown = [
    { name: 'COGS', value: Math.max(0, pnl.cogs), color: '#F59E0B' },
    { name: 'Praca', value: Math.max(0, pnl.laborCost), color: '#3B82F6' },
    { name: 'OPEX', value: Math.max(0, pnl.opex), color: '#8B5CF6' },
    { name: 'Zysk', value: Math.max(0, pnl.operatingProfit), color: '#10B981' },
  ].filter(d => d.value > 0)

  const hasDonutData = breakdown.length > 0 && pnl.netSales > 0
  const hasChartData = weeklyData.some(d => d.revenue > 0)

  const metrics = [
    {
      label: 'Food cost %',
      pct: pnl.cogsPercent * 100,
      target: 35,
      color: pnl.cogsPercent > 0.38 ? '#DC2626' : pnl.cogsPercent > 0.35 ? '#F59E0B' : '#16A34A',
      note: `Cel: 35%`,
    },
    {
      label: 'Koszt pracy %',
      pct: pnl.laborPercent * 100,
      target: 27,
      color: pnl.laborPercent > 0.30 ? '#DC2626' : pnl.laborPercent > 0.27 ? '#F59E0B' : '#16A34A',
      note: `Cel: 27%`,
    },
    {
      label: 'Marża brutto %',
      pct: pnl.grossMarginPercent * 100,
      target: 63,
      color: pnl.grossMarginPercent >= 0.63 ? '#16A34A' : pnl.grossMarginPercent >= 0.55 ? '#F59E0B' : '#DC2626',
      note: `Cel: 63%`,
    },
    {
      label: 'Marża netto %',
      pct: Math.max(0, pnl.netMargin * 100),
      target: 15,
      color: pnl.netMargin >= 0.15 ? '#16A34A' : pnl.netMargin >= 0.05 ? '#F59E0B' : '#DC2626',
      note: `Cel: 15%`,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Main chart row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Area chart - 2/3 */}
        <div className="col-span-2 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Trend sprzedaży</p>
              <p className="text-[18px] font-bold text-[#111827] mt-0.5">Ostatnie 7 dni</p>
            </div>
            {hasChartData && (
              <div className="text-right">
                <p className="text-[10px] text-[#9CA3AF]">Razem (7 dni)</p>
                <p className="text-[16px] font-bold text-[#2563EB]">
                  {PLN(weeklyData.reduce((s, d) => s + d.revenue, 0))}
                </p>
              </div>
            )}
          </div>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyData} margin={{ top: 4, right: 20, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  width={48}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Sprzedaż"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#gRevenue)"
                  dot={{ r: 4, fill: '#fff', stroke: '#2563EB', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2 pb-5">
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#2563EB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-[12px] text-[#9CA3AF]">Brak danych dla ostatnich 7 dni</p>
            </div>
          )}
        </div>

        {/* Donut chart - 1/3 */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Struktura kosztów</p>
          <p className="text-[18px] font-bold text-[#111827] mt-0.5 mb-4">Bieżący okres</p>

          {hasDonutData ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {breakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-[#9CA3AF] leading-none">Sprzedaż</p>
                    <p className="text-[14px] font-bold text-[#111827] mt-0.5">{PLN(pnl.netSales)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-1">
                {breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
                      <span className="text-[12px] text-[#6B7280]">{item.name}</span>
                    </div>
                    <span className="text-[12px] font-bold text-[#111827]">{PLN(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center">
                <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <p className="text-[12px] text-[#9CA3AF]">Brak danych kosztowych</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI Progress bars */}
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] leading-none">{m.label}</p>
              <span className="text-[20px] font-bold leading-none" style={{ color: m.color }}>
                {m.pct > 0 ? `${m.pct.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(Math.max(m.pct, 0), 100)}%`,
                  background: m.color,
                }}
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-2">{m.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
