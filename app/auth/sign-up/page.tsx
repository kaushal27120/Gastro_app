import { SignUpForm } from "@/components/sign-up-form";
import Link from "next/link";
import { OneLinkLogo } from "@/components/onelink-logo";

export default function SignUpPage() {
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
              Zacznij 7-dniowy<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                okres próbny
              </span>
            </h1>
            <p className="text-[15px] text-white/50 leading-relaxed max-w-sm">
              Pełny dostęp do platformy przez 7 dni. Subskrypcja automatycznie przedłuży się po trialu.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { title: "Krok 1", desc: "Utwórz konto właściciela z nazwą restauracji" },
              { title: "Krok 2", desc: "Wybierz plan i dodaj kartę płatniczą" },
              { title: "Krok 3", desc: "Zaproś zespół i zacznij zarządzać" },
            ].map((step, i) => (
              <div key={step.title} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/4 border border-white/6">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[11px] font-bold text-white">{i + 1}</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white">{step.title}</div>
                  <div className="text-[12px] text-white/45">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-white/25">
            Masz już konto?{" "}
            <Link href="/auth/login" className="text-amber-400/60 hover:text-amber-400 transition-colors">
              Zaloguj się →
            </Link>
          </p>
        </div>

        {/* Right panel */}
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
              <h2 className="text-[24px] font-bold text-white mb-1">Utwórz konto</h2>
              <p className="text-[13px] text-white/40">Wypełnij dane i zacznij trial</p>
            </div>
            <SignUpForm />
          </div>
        </div>
      </div>
    </main>
  );
}
