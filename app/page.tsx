"use client";

import Link from "next/link";
import { OneLinkLogo } from "@/components/onelink-logo";
import {
  TrendingUp, BarChart3, Package, Receipt, ShieldCheck,
  Users, ChevronRight, Check, ArrowRight, Zap, Star,
  Clock, PieChart, FileText, AlertCircle
} from "lucide-react";

/* ── tiny helpers ── */
const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/8 border border-white/12 text-[11px] font-semibold uppercase tracking-widest text-white/50">
    {children}
  </span>
);

const GradientText = ({ children }: { children: React.ReactNode }) => (
  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
    {children}
  </span>
);

/* ── data ── */
const STATS = [
  { value: "+4,2 pp", label: "Wzrost marży w 3 miesiące", color: "#10B981" },
  { value: "–70%", label: "Czas zamknięcia dnia", color: "#3B82F6" },
  { value: "12+", label: "Wykryte odchylenia / miesiąc", color: "#8B5CF6" },
  { value: "2 400 zł", label: "Oszczędności na food cost", color: "#F59E0B" },
];

const FEATURES = [
  {
    icon: BarChart3,
    color: "#3B82F6",
    title: "Dashboard P&L w czasie rzeczywistym",
    desc: "Widzisz sprzedaż, koszty i EBIT każdego dnia — nie czekasz na koniec miesiąca, żeby wiedzieć czy zarabiasz.",
    items: ["Sprzedaż netto i brutto", "Koszt pracy i food cost %", "EBIT i marża netto", "Alertuj przy odchyleniu"],
  },
  {
    icon: Package,
    color: "#8B5CF6",
    title: "Magazyn i odchylenia składników",
    desc: "Śledzisz stany, zamawiasz dostawy i widzisz gdzie znika towar — porównując zużycie teoretyczne z rzeczywistym.",
    items: ["Stany magazynowe w czasie rzeczywistym", "Transfery między lokalami", "Wykrywanie odchyleń food cost", "Historia dostaw"],
  },
  {
    icon: TrendingUp,
    color: "#F59E0B",
    title: "Kalkulator i symulator cen menu",
    desc: "Sprawdzasz food cost każdego dania i symulujesz co się stanie z marżą, kiedy zmieni się cena składnika.",
    items: ["Koszt produkcji per danie", "Symulacja zmiany cen surowców", "Status marży (OK / Uwaga / Krytyczny)", "Porównanie z targetem"],
  },
  {
    icon: Receipt,
    color: "#10B981",
    title: "Faktury i zatwierdzenia",
    desc: "Managerowie przesyłają faktury, Ty je zatwierdzasz jednym kliknięciem — wszystko z pełną historią i statusami.",
    items: ["Workflow zatwierdzania faktur", "Historia kosztów per lokalizacja", "Powiadomienia w czasie rzeczywistym", "Eksport do księgowości"],
  },
];

const TESTIMONIALS = [
  { name: "Marek W.", role: "Właściciel, 3 lokale", text: "Pierwszy raz w życiu wiem co się dzieje w moich restauracjach bez dzwonienia do managerów. Food cost spadł o 4 punkty." },
  { name: "Agnieszka K.", role: "CEO, sieć kawiarni", text: "Zamknięcie dnia zajmuje teraz 10 minut zamiast godziny. Managerowie mają jeden formularz, ja mam pełny raport." },
  { name: "Tomasz R.", role: "Właściciel, bistro", text: "Wykryłem że jeden składnik regularnie 'znika'. Bez GastroApp nigdy bym tego nie zauważył. Odbiłem 1 800 zł miesięcznie." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Zaloguj manager", desc: "Manager lokal dostaje konto i zaczyna wprowadzać dane ze swojego urządzenia." },
  { step: "02", title: "Dane wchodzą do systemu", desc: "Sprzedaż, faktury, inwentaryzacje — wszystko trafia do Twojego panelu automatycznie." },
  { step: "03", title: "Ty widzisz liczby", desc: "P&L, food cost, marże i alerty — w czasie rzeczywistym, na jednym ekranie." },
];

/* ── Dashboard Mockup ── */
function DashboardMockup() {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/12 shadow-2xl" style={{ background: '#0D1628' }}>
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-white/4">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4 h-6 rounded-md bg-white/8 flex items-center px-3">
          <div className="w-2 h-2 rounded-full bg-[#10B981] mr-2" />
          <span className="text-[10px] text-white/30 font-mono">app.onelink.pl/admin</span>
        </div>
      </div>

      {/* Sidebar + content */}
      <div className="flex" style={{ minHeight: 420 }}>
        {/* Sidebar */}
        <div className="w-[160px] border-r border-white/8 p-3 flex flex-col gap-0.5 shrink-0">
          <div className="h-8 px-3 mb-3 flex items-center">
            <span className="text-[12px] font-bold text-white">OneLink</span>
          </div>
          {[
            { icon: BarChart3, label: "Dashboard", active: true },
            { icon: PieChart, label: "P&L" },
            { icon: Receipt, label: "Faktury" },
            { icon: Package, label: "Magazyn" },
            { icon: FileText, label: "Raporty" },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-2 h-8 px-2.5 rounded-lg text-[11px] font-medium ${item.active ? 'bg-[#1E3A8A] text-[#93C5FD]' : 'text-white/30'}`}>
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 space-y-3 overflow-hidden">
          {/* KPI tiles */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Sprzedaż netto', val: '18 340 zł', sub: 'Plan: 18 000 zł', color: '#fff' },
              { label: 'Transakcje', val: '428', sub: 'AOV: 42,80 zł', color: '#fff' },
              { label: 'Food cost', val: '31,2%', sub: 'Cel: 35%', color: '#10B981' },
              { label: 'EBIT', val: '4 210 zł', sub: 'Marża: 22,9%', color: '#10B981' },
            ].map((t, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-[8px] font-semibold uppercase tracking-widest text-white/35 mb-1">{t.label}</p>
                <p className="text-[16px] font-black leading-none mb-1" style={{ color: t.color }}>{t.val}</p>
                <p className="text-[8px] text-white/25">{t.sub}</p>
              </div>
            ))}
          </div>

          {/* Chart + donut row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Area chart mockup */}
            <div className="col-span-2 bg-white/5 border border-white/8 rounded-xl p-3">
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/35 mb-3">Trend sprzedaży — 7 dni</p>
              <div className="relative h-[90px]">
                <svg viewBox="0 0 200 80" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M 0,60 C 30,55 50,40 70,45 S 110,30 130,25 S 170,10 200,20 L 200,80 L 0,80 Z" fill="url(#chartGrad)" />
                  <path d="M 0,60 C 30,55 50,40 70,45 S 110,30 130,25 S 170,10 200,20" fill="none" stroke="#3B82F6" strokeWidth="2" />
                  {[[0,60],[70,45],[130,25],[200,20]].map(([x,y],i) => (
                    <circle key={i} cx={x} cy={y} r="3" fill="white" stroke="#3B82F6" strokeWidth="1.5" />
                  ))}
                  <line x1="0" y1="80" x2="200" y2="80" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
                  {['Pn','Wt','Śr','Cz','Pt','Sb','Nd'].map(d => (
                    <span key={d} className="text-[7px] text-white/25">{d}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut mockup */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-3">
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/35 mb-2">Koszty</p>
              <div className="flex justify-center mb-2">
                <svg viewBox="0 0 80 80" className="w-16 h-16">
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#F59E0B" strokeWidth="10" strokeDasharray="52 124" strokeDashoffset="31" />
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#3B82F6" strokeWidth="10" strokeDasharray="37 124" strokeDashoffset="-21" />
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#8B5CF6" strokeWidth="10" strokeDasharray="21 124" strokeDashoffset="-58" />
                  <circle cx="40" cy="40" r="28" fill="none" stroke="#10B981" strokeWidth="10" strokeDasharray="14 124" strokeDashoffset="-79" />
                </svg>
              </div>
              <div className="space-y-1">
                {[['COGS','#F59E0B','31%'],['Praca','#3B82F6','24%'],['OPEX','#8B5CF6','22%'],['Zysk','#10B981','23%']].map(([l,c,v])=>(
                  <div key={l} className="flex items-center justify-between">
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-sm" style={{background:c}}/><span className="text-[8px] text-white/35">{l}</span></div>
                    <span className="text-[8px] font-bold" style={{color:c}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alert bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#10B981]/10 border border-[#10B981]/25 rounded-lg">
            <ShieldCheck className="w-3 h-3 text-[#10B981] shrink-0" />
            <span className="text-[9px] text-[#10B981] font-semibold">Rentowność OK · Brak krytycznych odchyleń</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#060B18] text-white overflow-x-hidden">

      {/* Background grid pattern */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
      }} />

      {/* Top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 65%)' }} />

      {/* ── TOP BANNER — Made by InnowacyjneAI ── */}
      <div className="relative z-50 w-full border-b border-violet-500/15" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 50%, rgba(139,92,246,0.12) 100%)' }}>
        <a
          href="https://innowacyjneai.pl/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 py-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-center w-4 h-4 rounded-sm" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
            <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-white" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="6" r="3" />
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2" />
            </svg>
          </div>
          <span className="text-[12px] font-medium text-white/50">
            Zaprojektowane i zbudowane przez
          </span>
          <span className="text-[12px] font-bold" style={{ background: 'linear-gradient(90deg, #A78BFA, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            InnowacyjneAI
          </span>
          <span className="text-[11px] text-violet-400/50">→ innowacyjneai.pl</span>
        </a>
      </div>

      {/* ── NAV ── */}
      <nav className="relative z-50 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <OneLinkLogo iconSize={28} textSize="text-[15px]" />
        <div className="hidden md:flex items-center gap-6">
          {[['Funkcje', '#features'], ['Jak działa', '#how'], ['Cennik', '/pricing']].map(([label, href]) => (
            <a key={label} href={href} className="text-[13px] text-white/50 hover:text-white transition-colors font-medium">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-[13px] text-white/50 hover:text-white transition-colors font-medium">
            Zaloguj
          </Link>
          <Link href="/pricing" className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[13px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center shadow-lg shadow-amber-500/25">
            Zacznij za darmo
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-8 text-center">
        <Pill>
          <Zap className="w-3 h-3 text-amber-400" />
          7 dni za darmo · trial z kartą Stripe
        </Pill>

        <h1 className="mt-8 text-[52px] md:text-[76px] font-black tracking-[-0.03em] leading-[1.0] mb-6 max-w-4xl mx-auto">
          Zarządzaj restauracją{" "}
          <br className="hidden md:block" />
          <GradientText>jak profesjonalista</GradientText>
        </h1>

        <p className="text-[18px] text-white/45 max-w-2xl mx-auto leading-relaxed mb-10">
          Jeden panel do P&amp;L, food cost, magazynu i faktur — dla właścicieli restauracji którzy chcą wiedzieć co się dzieje, nie dopiero na koniec miesiąca.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link href="/pricing" className="h-13 px-8 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-[15px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center gap-2 shadow-xl shadow-amber-500/30" style={{ height: 52 }}>
            Zacznij bezpłatny trial
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="#features" className="h-13 px-8 rounded-2xl border border-white/15 text-[15px] font-semibold text-white/70 hover:text-white hover:border-white/30 transition-all flex items-center gap-2" style={{ height: 52 }}>
            Zobacz jak działa
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dashboard mockup */}
        <div className="relative max-w-4xl mx-auto">
          {/* Glow behind the mockup */}
          <div className="absolute -inset-8 rounded-3xl pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(37,99,235,0.2) 0%, transparent 70%)' }} />
          <DashboardMockup />
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-6 text-center hover:bg-white/6 transition-colors">
              <p className="text-[36px] font-black leading-none mb-2" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] text-white/40 font-medium leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-16">
          <Pill><Star className="w-3 h-3 text-amber-400" />Funkcje</Pill>
          <h2 className="text-[40px] md:text-[52px] font-black tracking-tight mt-6 mb-4">
            Wszystko co potrzebuje<br />
            <GradientText>właściciel restauracji</GradientText>
          </h2>
          <p className="text-[16px] text-white/40 max-w-xl mx-auto">
            Zaprojektowane specjalnie dla branży F&amp;B — nie generyczny software dostosowany na siłę.
          </p>
        </div>

        <div className="space-y-5">
          {FEATURES.map((f, i) => (
            <div key={i} className={`grid md:grid-cols-2 gap-6 items-center rounded-3xl p-8 border border-white/8 bg-white/3 hover:bg-white/5 transition-colors ${i % 2 === 1 ? '' : ''}`}>
              {/* Text side */}
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ background: `${f.color}20` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-[22px] font-bold text-white mb-3 leading-snug">{f.title}</h3>
                <p className="text-[14px] text-white/45 leading-relaxed mb-5">{f.desc}</p>
                <ul className="space-y-2">
                  {f.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-[13px] text-white/60">
                      <Check className="w-4 h-4 shrink-0" style={{ color: f.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual side */}
              <div className={`rounded-2xl overflow-hidden border border-white/8 ${i % 2 === 1 ? 'md:order-1' : ''}`} style={{ background: '#0D1628' }}>
                <div className="p-5 space-y-3">
                  {i === 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {[['Sprzedaż netto','18 340 zł','#fff'],['EBIT','4 210 zł','#10B981']].map(([l,v,c])=>(
                          <div key={l} className="bg-white/5 rounded-xl p-3 border border-white/8">
                            <p className="text-[9px] uppercase tracking-widest text-white/35 mb-1">{l}</p>
                            <p className="text-[18px] font-black leading-none" style={{color:c}}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                        <p className="text-[9px] uppercase tracking-widest text-white/35 mb-2">Trend tygodniowy</p>
                        <div className="flex items-end gap-1.5 h-14">
                          {[40,58,52,71,63,80,74].map((h,j)=>(
                            <div key={j} className="flex-1 rounded-t-sm" style={{height:`${h}%`, background: j===5?'#3B82F6':'rgba(59,130,246,0.3)'}}/>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg">
                        <ShieldCheck className="w-3 h-3 text-[#10B981]"/>
                        <span className="text-[9px] text-[#10B981] font-semibold">Brak krytycznych odchyleń</span>
                      </div>
                    </>
                  )}
                  {i === 1 && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {[['Na stanie','284 kg','#fff'],['Zarezerwowane','42 kg','#F59E0B'],['Alerty','2','#DC2626']].map(([l,v,c])=>(
                          <div key={l} className="bg-white/5 rounded-xl p-3 border border-white/8 text-center">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 mb-1">{l}</p>
                            <p className="text-[16px] font-black leading-none" style={{color:c}}>{v}</p>
                          </div>
                        ))}
                      </div>
                      {[['Łosoś atlantycki','12.4 kg','OK','#10B981'],['Wołowina','3.1 kg','Niski','#DC2626'],['Masło','8.0 kg','OK','#10B981']].map(([name,qty,status,c])=>(
                        <div key={name} className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/8 rounded-lg">
                          <span className="text-[11px] text-white/60 font-medium">{name}</span>
                          <span className="text-[11px] text-white/35">{qty}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{color:c, background:`${c}18`}}>{status}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {i === 2 && (
                    <>
                      {[
                        ['Burger Wołowy','14,20 zł','42,00 zł','33,8%','#10B981','OK'],
                        ['Łosoś Grillowany','28,10 zł','68,00 zł','41,3%','#DC2626','Krytyczny'],
                        ['Sałatka Cezar','8,50 zł','28,00 zł','30,4%','#10B981','OK'],
                      ].map(([name,cost,price,pct,c,status])=>(
                        <div key={name} className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-semibold text-white">{name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{color:c, background:`${c}18`}}>{status}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] text-white/35">Koszt: <span className="text-white/60">{cost}</span></span>
                            <span className="text-[10px] text-white/35">Menu: <span className="text-white/60">{price}</span></span>
                            <span className="text-[10px] font-bold" style={{color:c}}>FC: {pct}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {i === 3 && (
                    <>
                      {[
                        ['FV/2026/041','Sysco Polska','1 240 zł','submitted','#3B82F6'],
                        ['FV/2026/039','Metro Cash','890 zł','approved','#10B981'],
                        ['FV/2026/038','Lyreco','320 zł','approved','#10B981'],
                      ].map(([nr,sup,amt,status,c])=>(
                        <div key={nr} className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/8 rounded-xl">
                          <div>
                            <p className="text-[11px] font-semibold text-white">{sup}</p>
                            <p className="text-[9px] text-white/30 mt-0.5">{nr}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] font-bold text-white">{amt}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{color:c, background:`${c}18`}}>
                              {status === 'approved' ? 'Zatwierdzona' : 'Do zatwierdzenia'}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <div className="flex-1 h-8 rounded-lg bg-[#DC2626]/20 border border-[#DC2626]/30 flex items-center justify-center text-[10px] font-bold text-[#DC2626]">Odrzuć</div>
                        <div className="flex-1 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center text-[10px] font-bold text-white">Zatwierdź</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="relative max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <Pill><Clock className="w-3 h-3 text-blue-400" />Jak działa</Pill>
          <h2 className="text-[36px] md:text-[48px] font-black tracking-tight mt-6 mb-4">
            Gotowy w <GradientText>20 minut</GradientText>
          </h2>
          <p className="text-[15px] text-white/40">Bez implementacji, bez szkoleń, bez IT.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} className="relative bg-white/3 border border-white/8 rounded-2xl p-7 hover:bg-white/5 transition-colors">
              <div className="text-[52px] font-black leading-none mb-5" style={{ color: 'rgba(255,255,255,0.06)' }}>
                {step.step}
              </div>
              <h3 className="text-[18px] font-bold text-white mb-2">{step.title}</h3>
              <p className="text-[13px] text-white/40 leading-relaxed">{step.desc}</p>
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#1E40AF] border border-blue-500/40 items-center justify-center z-10">
                  <ChevronRight className="w-3 h-3 text-blue-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="relative max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <Pill><Star className="w-3 h-3 text-amber-400" />Opinie</Pill>
          <h2 className="text-[36px] md:text-[46px] font-black tracking-tight mt-6 mb-4">
            Właściciele restauracji już korzystają
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-white/4 border border-white/8 rounded-2xl p-6 hover:bg-white/6 transition-colors">
              <div className="flex mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-[14px] text-white/60 leading-relaxed mb-5 italic">"{t.text}"</p>
              <div>
                <p className="text-[13px] font-bold text-white">{t.name}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING TEASER ── */}
      <section className="relative max-w-4xl mx-auto px-6 pb-24">
        <div className="rounded-3xl p-px" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.5), rgba(245,158,11,0.3), rgba(37,99,235,0.2))' }}>
          <div className="rounded-3xl p-10 md:p-14 text-center" style={{ background: 'linear-gradient(135deg, #0D1628 0%, #0A0F1E 100%)' }}>
            <Pill>
              <Zap className="w-3 h-3 text-amber-400" />
              Cennik
            </Pill>
            <h2 className="text-[36px] md:text-[52px] font-black tracking-tight mt-6 mb-4">
              Od <GradientText>299 zł</GradientText> miesięcznie
            </h2>
            <p className="text-[15px] text-white/45 max-w-lg mx-auto mb-8 leading-relaxed">
              7 dni za darmo, bez podania karty. Wybierz plan który pasuje do skali Twojego biznesu — i anuluj kiedy chcesz.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/pricing" className="h-12 px-8 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-[14px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/30">
                Porównaj plany
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/auth/login" className="text-[13px] text-white/40 hover:text-white/70 transition-colors">
                Masz już konto? Zaloguj się →
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5">
              {['Bez karty do trialu', 'Anuluj kiedy chcesz', 'Pełny dostęp przez 7 dni', 'Wsparcie w języku polskim'].map(item => (
                <div key={item} className="flex items-center gap-2 text-[12px] text-white/35">
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MADE BY INNOWACYJNEAI ── */}
      <section className="relative max-w-4xl mx-auto px-6 pb-20">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />

        <a
          href="https://innowacyjneai.pl/"
          target="_blank"
          rel="noopener noreferrer"
          className="group block relative"
        >
          {/* Gradient border wrapper */}
          <div className="rounded-2xl p-px transition-all duration-500 group-hover:shadow-[0_0_60px_rgba(139,92,246,0.2)]"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(59,130,246,0.3) 50%, rgba(139,92,246,0.15) 100%)' }}>
            <div className="rounded-2xl px-8 py-7 flex flex-col sm:flex-row items-center gap-6"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(15,20,40,0.95) 60%, rgba(59,130,246,0.04) 100%)' }}>

              {/* AI icon */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(59,130,246,0.2) 100%)', border: '1px solid rgba(139,92,246,0.35)' }}>
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="url(#aiGrad)" strokeWidth="1.5">
                    <defs>
                      <linearGradient id="aiGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" />
                        <stop offset="100%" stopColor="#60A5FA" />
                      </linearGradient>
                    </defs>
                    <path d="M12 2a4 4 0 014 4v1h1a3 3 0 010 6h-1v1a4 4 0 01-8 0v-1H7a3 3 0 010-6h1V6a4 4 0 014-4z" />
                    <circle cx="9" cy="9" r="1" fill="#A78BFA" stroke="none" />
                    <circle cx="15" cy="9" r="1" fill="#60A5FA" stroke="none" />
                    <path d="M9 15s1 1.5 3 1.5 3-1.5 3-1.5" strokeLinecap="round" />
                  </svg>
                </div>
                {/* Pulse dot */}
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#8B5CF6] border-2 border-[#060B18] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">Zaprojektowane i zbudowane przez</span>
                </div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-[22px] font-black tracking-tight"
                    style={{ background: 'linear-gradient(90deg, #A78BFA 0%, #60A5FA 50%, #A78BFA 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    InnowacyjneAI
                  </span>
                  <span className="hidden sm:flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold text-violet-300 border border-violet-500/30"
                    style={{ background: 'rgba(139,92,246,0.12)' }}>
                    AI Agency
                  </span>
                </div>
                <p className="text-[13px] text-white/35 mt-1">
                  Budujemy inteligentne oprogramowanie i rozwiązania AI dla biznesu
                </p>
              </div>

              {/* Arrow CTA */}
              <div className="flex-shrink-0 flex items-center gap-2 text-[13px] font-semibold text-violet-400/70 group-hover:text-violet-300 transition-colors">
                <span className="hidden sm:block">innowacyjneai.pl</span>
                <div className="w-8 h-8 rounded-full border border-violet-500/30 flex items-center justify-center group-hover:border-violet-400/60 group-hover:bg-violet-500/10 transition-all"
                  style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </a>
      </section>

      {/* ── EMPLOYEE APP SECTION ── */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <Pill>📱 Aplikacja mobilna</Pill>
            <h2 className="text-[32px] md:text-[40px] font-black text-white mt-4 mb-3 leading-tight">
              Grafik zawsze <GradientText>pod ręką</GradientText>
            </h2>
            <p className="text-[16px] text-white/40 max-w-xl mx-auto">
              Pracownicy mogą sprawdzić swój harmonogram na telefonie — iOS i Android.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-center">
            {/* Phone mockup */}
            <div className="flex justify-center">
              <div className="relative w-[220px]">
                <div className="w-[220px] h-[420px] rounded-[36px] border-[6px] border-white/10 bg-[#0D1425] overflow-hidden shadow-2xl shadow-blue-500/20">
                  {/* Status bar */}
                  <div className="h-8 bg-[#0D1425] flex items-center justify-between px-5 pt-1">
                    <span className="text-[9px] text-white/40 font-semibold">9:41</span>
                    <div className="w-16 h-3 bg-black rounded-full" />
                    <span className="text-[9px] text-white/40">●●●</span>
                  </div>
                  {/* App UI preview */}
                  <div className="px-4 pt-3 space-y-3">
                    <div className="text-white font-bold text-[13px]">Cześć, Jan 👋</div>
                    <div className="rounded-2xl p-4" style={{ background: '#1E3A8A' }}>
                      <div className="text-[8px] text-blue-300/60 font-bold tracking-widest mb-1">NASTĘPNA ZMIANA</div>
                      <div className="text-white font-bold text-[13px] mb-1">Pt, 21 mar</div>
                      <div className="text-blue-200 text-[11px] font-semibold">08:00 – 16:00</div>
                      <div className="text-blue-300/50 text-[9px] mt-1">📍 Lokal Centrum</div>
                    </div>
                    {[
                      { day: 'Pon', shift: '08:00–16:00', pos: 'kucharz', posColor: '#9A3412', posBg: '#FED7AA' },
                      { day: 'Wt', shift: 'wolne', pos: null, posColor: '', posBg: '' },
                      { day: 'Śr', shift: '12:00–20:00', pos: 'kelner', posColor: '#1E40AF', posBg: '#BFDBFE' },
                    ].map(d => (
                      <div key={d.day} className="rounded-xl px-3 py-2.5 bg-white/5 border border-white/6 flex justify-between items-center">
                        <div>
                          <div className="text-[9px] font-bold text-white/50">{d.day}</div>
                          <div className="text-[10px] text-white/70 font-semibold">{d.shift}</div>
                        </div>
                        {d.pos && (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: d.posBg, color: d.posColor }}>{d.pos}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* glow */}
                <div className="absolute inset-0 rounded-[36px] pointer-events-none"
                  style={{ boxShadow: '0 0 60px rgba(59,130,246,0.15)' }} />
              </div>
            </div>

            {/* Features + download */}
            <div className="space-y-6">
              {[
                { icon: '📅', title: 'Grafik tygodniowy', desc: 'Widok tygodnia i lista zmian w jednym miejscu.' },
                { icon: '🔔', title: 'Aktualizacje w czasie rzeczywistym', desc: 'Odśwież aplikację i masz zawsze aktualny grafik.' },
                { icon: '📍', title: 'Informacje o lokalizacji', desc: 'Nazwa lokalu i godziny przy każdej zmianie.' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-white mb-0.5">{f.title}</div>
                    <div className="text-[13px] text-white/40">{f.desc}</div>
                  </div>
                </div>
              ))}

              {/* Download buttons */}
              <div className="pt-2 space-y-3">
                <p className="text-[11px] text-white/30 uppercase tracking-widest font-semibold">Pobierz aplikację</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://apps.apple.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/12 bg-white/5 hover:bg-white/8 transition-all group"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current flex-shrink-0">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <div>
                      <div className="text-[9px] text-white/40 leading-none">Pobierz z</div>
                      <div className="text-[13px] font-semibold text-white leading-tight">App Store</div>
                    </div>
                  </a>
                  <a
                    href="https://play.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/12 bg-white/5 hover:bg-white/8 transition-all group"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current flex-shrink-0" style={{ color: '#4ADE80' }}>
                      <path d="M3.18 23.76c.3.17.64.24.99.18L14.64 12 3.18.06c-.35-.06-.69.01-.99.18C1.55.73 1.2 1.55 1.2 2.45v19.1c0 .9.35 1.72.98 2.21zM16.09 10.5l2.3-2.3-9.87-5.59L16.09 10.5zM22.35 10.29l-3.26-1.84-2.57 2.57 2.57 2.57 3.3-1.87c.94-.54.94-1.9-.04-1.43zM8.52 13.5l-6-6.02v9.04l6-3.02zm3 1.7l-2.42 1.42 9.87 5.59-7.45-7.01z"/>
                    </svg>
                    <div>
                      <div className="text-[9px] text-white/40 leading-none">Pobierz z</div>
                      <div className="text-[13px] font-semibold text-white leading-tight">Google Play</div>
                    </div>
                  </a>
                </div>
                <p className="text-[11px] text-white/20">
                  Aplikacja dostępna wkrótce w sklepach. Już teraz dostępna jako wersja webowa pod{' '}
                  <Link href="/employee" className="text-blue-400/60 hover:text-blue-400 transition-colors">/employee</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/6 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <OneLinkLogo iconSize={22} textSize="text-[13px]" />
          <p className="text-[12px] text-white/20">
            © 2026 OneLink · Zbudowane przez{" "}
            <a href="https://innowacyjneai.pl/" target="_blank" rel="noopener noreferrer"
              className="text-violet-400/50 hover:text-violet-400 transition-colors">
              InnowacyjneAI
            </a>
          </p>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-[12px] text-white/30 hover:text-white/60 transition-colors">Cennik</Link>
            <Link href="/auth/login" className="text-[12px] text-white/30 hover:text-white/60 transition-colors">Logowanie</Link>
            <Link href="/auth/sign-up" className="text-[12px] text-white/30 hover:text-white/60 transition-colors">Rejestracja</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
