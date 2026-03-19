"use client";

import { useState } from "react";
import { OneLinkLogo } from "@/components/onelink-logo";
import { useRouter } from "next/navigation";
import { Check, Zap, Building2, Globe, TrendingUp, ShieldCheck, BarChart3, Package, Receipt, Users } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  price: string;
  period: string;
  priceId: string;
  features: string[];
  cta: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "plan1",
    name: "Start",
    subtitle: "Dla jednego lokalu",
    description: "Wszystko czego potrzebujesz, żeby mieć pełną kontrolę nad jednym miejscem.",
    price: "299",
    period: "/ miesiąc",
    priceId: "price_1T6UApAXlOaqQJTKBSRI5PU0",
    cta: "Zacznij 7-dniowy trial",
    features: [
      "1 lokal · 1 manager",
      "Panel właściciela z raportami sprzedaży",
      "Panel Ops do wprowadzania danych",
      "Raport dzienny P&L",
      "Alerty i powiadomienia",
      "Wsparcie e-mail",
    ],
  },
  {
    id: "plan2",
    name: "Rozwój",
    subtitle: "Dla rosnącej sieci",
    description: "Pełna kontrola operacyjna — faktury, magazyn, food cost i zaawansowane raporty.",
    price: "599",
    period: "/ miesiąc",
    priceId: "price_1T6UBEAXlOaqQJTKNV4UBscv",
    cta: "Zacznij 7-dniowy trial",
    popular: true,
    features: [
      "Do 2 lokali · 2 managerów",
      "Sprzedaż + faktury zakupowe",
      "Moduł inwentaryzacji i magazynu",
      "Alerty cenowe i raporty food cost",
      "Symulacje cen menu",
      "Priorytetowe wsparcie",
    ],
  },
  {
    id: "plan3",
    name: "Sieć",
    subtitle: "Dla większych operacji",
    description: "Dla sieci restauracji — pełen dostęp, raporty cross-lokalizacyjne i API.",
    price: "1 199",
    period: "/ miesiąc",
    priceId: "price_1T6UBVAXlOaqQJTKZeprLa8H",
    cta: "Zacznij 7-dniowy trial",
    features: [
      "Do 5 lokali · 5 managerów",
      "Pełny dostęp P&L i EBIT",
      "Panel regionalny i finansowy",
      "Zaawansowane raporty i analizy",
      "Eksport danych i integracje",
      "Dedykowany opiekun konta",
    ],
  },
];

const METRICS = [
  { icon: TrendingUp, label: "Średni wzrost marży", value: "+4,2 pp", color: "#10B981" },
  { icon: BarChart3, label: "Czas zamknięcia dnia", value: "–70%", color: "#3B82F6" },
  { icon: ShieldCheck, label: "Wykryte odchylenia / mies.", value: "12+", color: "#8B5CF6" },
  { icon: Package, label: "Zaoszczędzone na food cost", value: "2 400 zł", color: "#F59E0B" },
];

const FEATURES = [
  { icon: BarChart3, title: "Dashboard P&L w czasie rzeczywistym", desc: "Widzisz rentowność każdego dnia — przychody, COGS, labor i EBIT na jednym ekranie." },
  { icon: Receipt, title: "Zatwierdzanie faktur", desc: "Managerowie przesyłają faktury, Ty zatwierdzasz lub odrzucasz jednym kliknięciem." },
  { icon: Package, title: "Moduł magazynowy", desc: "Pełna kontrola stanów, transferów między lokalami i wykrywanie odchyleń." },
  { icon: TrendingUp, title: "Symulator cen menu", desc: "Sprawdź jak zmiana ceny składnika wpłynie na marżę każdego dania." },
  { icon: Users, title: "Multi-lokalizacja", desc: "Zarządzaj kilkoma lokalami z jednego panelu. Raporty zagregowane lub per-lokal." },
  { icon: ShieldCheck, title: "Alerty i powiadomienia", desc: "Natychmiastowe powiadomienia o przekroczeniu progów — labor, food cost, gotówka." },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (plan: Plan) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.priceId, planCode: plan.id }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/auth/sign-up"; return; }
      if (!res.ok || !data.url) throw new Error(data.error || "Nie udało się rozpocząć płatności");
      window.location.href = data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd podczas łączenia ze Stripe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0F1E] text-white overflow-x-hidden">

      {/* Top nav */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <OneLinkLogo iconSize={26} textSize="text-[15px]" />
        <a href="/auth/login" className="h-8 px-4 rounded-lg border border-white/20 text-[12px] font-medium text-white/70 hover:text-white hover:border-white/40 transition-colors flex items-center">
          Zaloguj się
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-8">
          <Zap className="w-3 h-3 text-amber-400" />
          7 dni za darmo · trial z kartą Stripe
        </div>
        <h1 className="text-[48px] md:text-[64px] font-black tracking-tight leading-[1.05] mb-6">
          Restauracja pod{" "}
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            pełną kontrolą
          </span>
        </h1>
        <p className="text-[17px] text-white/55 max-w-2xl mx-auto leading-relaxed">
          Jeden panel do zarządzania sprzedażą, food costem, magazynem i fakturami. Widzisz zysk każdego dnia — nie dopiero na koniec miesiąca.
        </p>
      </section>

      {/* Metrics strip */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {METRICS.map((m, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${m.color}20` }}>
                <m.icon className="w-5 h-5" style={{ color: m.color }} />
              </div>
              <p className="text-[26px] font-black" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[11px] text-white/40 mt-1 font-medium leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mock dashboard preview */}
      <section className="max-w-5xl mx-auto px-6 mb-24">
        <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(16,185,129,0.05) 100%)' }}>
          {/* Fake browser bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            <div className="flex-1 mx-4 h-6 rounded-md bg-white/10 flex items-center px-3">
              <span className="text-[11px] text-white/30 font-mono">app.onelink.pl/admin</span>
            </div>
          </div>
          {/* Dashboard mockup */}
          <div className="p-6 space-y-4">
            {/* KPI tiles */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Sprzedaż netto', value: '18 340 zł', color: '#fff' },
                { label: 'Średni paragon', value: '42,80 zł', color: '#fff' },
                { label: 'Food cost', value: '31,2%', color: '#10B981' },
                { label: 'EBIT', value: '4 210 zł', color: '#10B981' },
              ].map((t, i) => (
                <div key={i} className="bg-white/8 border border-white/10 rounded-xl p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t.label}</p>
                  <p className="text-[20px] font-black leading-none" style={{ color: t.color }}>{t.value}</p>
                </div>
              ))}
            </div>
            {/* Chart row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-white/8 border border-white/10 rounded-xl p-4 h-40">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40 mb-3">Trend sprzedaży — ostatnie 7 dni</p>
                <div className="flex items-end gap-2 h-24">
                  {[45, 62, 58, 71, 53, 80, 74].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 5 ? '#3B82F6' : 'rgba(59,130,246,0.35)' }} />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(d => (
                    <p key={d} className="text-[9px] text-white/30 flex-1 text-center">{d}</p>
                  ))}
                </div>
              </div>
              <div className="bg-white/8 border border-white/10 rounded-xl p-4 h-40 flex flex-col justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40">Struktura kosztów</p>
                <div className="space-y-2">
                  {[
                    { label: 'COGS', pct: 31, color: '#F59E0B' },
                    { label: 'Praca', pct: 24, color: '#3B82F6' },
                    { label: 'OPEX', pct: 22, color: '#8B5CF6' },
                    { label: 'Zysk', pct: 23, color: '#10B981' },
                  ].map((c, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[9px] text-white/40">{c.label}</span>
                        <span className="text-[9px] font-bold" style={{ color: c.color }}>{c.pct}%</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-1 rounded-full" style={{ width: `${c.pct * 2.5}%`, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.12) 0%, transparent 60%)' }} />
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="text-center mb-12">
          <h2 className="text-[36px] font-black tracking-tight mb-3">Prosty cennik, zero niespodzianek</h2>
          <p className="text-[15px] text-white/45">7 dni bezpłatnie na każdym planie. Anuluj w dowolnym momencie.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl p-6 transition-all ${
                plan.popular
                  ? "bg-white text-[#111827] ring-0 shadow-2xl shadow-amber-500/20 scale-[1.03]"
                  : "bg-white/5 border border-white/12 text-white hover:bg-white/8"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-[11px] font-bold text-white tracking-wide shadow-lg">
                  NAJCZĘŚCIEJ WYBIERANY
                </div>
              )}

              <div className="mb-5">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold mb-3 ${plan.popular ? 'bg-amber-50 text-amber-700' : 'bg-white/10 text-white/60'}`}>
                  {plan.id === 'plan1' && <Building2 className="w-3 h-3" />}
                  {plan.id === 'plan2' && <TrendingUp className="w-3 h-3" />}
                  {plan.id === 'plan3' && <Globe className="w-3 h-3" />}
                  {plan.subtitle}
                </div>
                <h3 className={`text-[26px] font-black tracking-tight mb-1 ${plan.popular ? 'text-[#111827]' : 'text-white'}`}>
                  {plan.name}
                </h3>
                <p className={`text-[13px] leading-relaxed ${plan.popular ? 'text-[#6B7280]' : 'text-white/45'}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-[44px] font-black leading-none ${plan.popular ? 'text-[#111827]' : 'text-white'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-[13px] font-medium ${plan.popular ? 'text-[#9CA3AF]' : 'text-white/40'}`}>
                    zł{plan.period}
                  </span>
                </div>
                <p className={`text-[12px] mt-1 ${plan.popular ? 'text-[#9CA3AF]' : 'text-white/35'}`}>
                  + VAT · po 7-dniowym trialu
                </p>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.popular ? 'text-[#16A34A]' : 'text-white/40'}`} />
                    <span className={`text-[13px] ${plan.popular ? 'text-[#374151]' : 'text-white/65'}`}>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loading}
                className={`w-full h-11 rounded-xl font-bold text-[14px] transition-all disabled:opacity-60 ${
                  plan.popular
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 shadow-lg shadow-amber-500/30"
                    : "bg-white/10 border border-white/20 text-white hover:bg-white/15"
                }`}
              >
                {loading ? "Przekierowanie..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center mt-6">{error}</p>
        )}
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-6 mb-24">
        <div className="text-center mb-12">
          <h2 className="text-[30px] font-black tracking-tight mb-3">Wszystko w jednym miejscu</h2>
          <p className="text-[14px] text-white/45">Zaprojektowane specjalnie dla branży restauracyjnej</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-white/4 border border-white/10 rounded-2xl p-5 hover:bg-white/7 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <f.icon className="w-4.5 h-4.5 text-white/70" />
              </div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-[13px] text-white/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1e40af] rounded-3xl p-10 border border-blue-500/30">
          <h2 className="text-[28px] font-black tracking-tight mb-3">Gotowy zacząć?</h2>
          <p className="text-[14px] text-blue-200 mb-8 leading-relaxed">
            7 dni za darmo, bez podania karty. Po trialu wybierz plan który odpowiada Twojej skali.
          </p>
          <button
            onClick={() => handleSubscribe(PLANS[1])}
            disabled={loading}
            className="h-12 px-8 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-[14px] hover:from-amber-500 hover:to-orange-600 shadow-xl shadow-amber-500/30 transition-all disabled:opacity-60"
          >
            Zacznij bezpłatny trial
          </button>
          <p className="text-[11px] text-blue-300/60 mt-4">Trial z kartą Stripe · Anuluj kiedy chcesz · Pełny dostęp przez 7 dni</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8">
        <p className="text-center text-[12px] text-white/25">© 2026 OneLink · Dla właścicieli restauracji</p>
      </footer>
    </main>
  );
}
