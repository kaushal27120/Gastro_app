import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { OneLinkLogo } from "@/components/onelink-logo";

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #060B18 0%, #0D1425 50%, #060B18 100%)" }}
    >
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(245,158,11,0.08) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-5xl flex items-center gap-16">
        {/* Left panel */}
        <div className="hidden lg:flex flex-col flex-1 gap-8">
          <div>
            <OneLinkLogo className="mb-8" />
            <h1 className="text-[38px] font-bold text-white leading-[1.15] mb-4">
              Zarządzaj restauracją<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                na wyższym poziomie
              </span>
            </h1>
            <p className="text-[15px] text-white/50 leading-relaxed max-w-sm">
              Kontroluj sprzedaż, koszty, magazyn i zespół w jednym miejscu. Dane w czasie rzeczywistym.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: "📊", title: "Raporty P&L", desc: "Rentowność każdego dnia, tygodnia i miesiąca" },
              { icon: "🏪", title: "Multi-lokal", desc: "Zarządzaj siecią z jednego panelu" },
              { icon: "👥", title: "Zarządzanie zespołem", desc: "Role, grafiki i uprawnienia dla całego personelu" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/4 border border-white/6">
                <span className="text-[20px] mt-0.5">{item.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold text-white">{item.title}</div>
                  <div className="text-[12px] text-white/45">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-white/25">
            Nie masz konta?{" "}
            <Link href="/pricing" className="text-amber-400/60 hover:text-amber-400 transition-colors">
              Sprawdź plany cenowe →
            </Link>
          </p>
        </div>

        {/* Right panel — form card */}
        <div className="w-full max-w-[420px] mx-auto lg:mx-0">
          {/* Logo for mobile */}
          <div className="flex lg:hidden justify-center mb-8">
            <OneLinkLogo />
          </div>

          <div
            className="rounded-2xl p-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="mb-7">
              <h2 className="text-[24px] font-bold text-white mb-1">Zaloguj się</h2>
              <p className="text-[13px] text-white/40">Witaj z powrotem w OneLink</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
