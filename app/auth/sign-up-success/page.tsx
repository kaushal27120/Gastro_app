"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Mail } from "lucide-react";
import { OneLinkLogo } from "@/components/onelink-logo";

export default function SignUpSuccessPage() {
  const router = useRouter();

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
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(34,197,94,0.07) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[480px] mx-auto">
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <OneLinkLogo />
          </div>

          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-green-500/12 border border-green-500/25 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>

          <h1 className="text-[28px] font-bold text-white mb-3">Konto utworzone!</h1>
          <p className="text-[14px] text-white/50 leading-relaxed mb-2">
            Sprawdź swoją skrzynkę e-mail i potwierdź adres, aby aktywować konto.
          </p>
          <p className="text-[13px] text-white/30 mb-8">
            Sprawdź też folder spam, jeśli wiadomość nie dotarła.
          </p>

          {/* Email icon strip */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white/4 border border-white/8 mb-8">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <div className="text-[13px] font-semibold text-white">Link potwierdzający wysłany</div>
              <div className="text-[12px] text-white/40">Kliknij link w emailu, aby aktywować konto</div>
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[14px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
            >
              <span>Wybierz plan subskrypcji</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/auth/login")}
              className="w-full h-11 rounded-xl text-[14px] font-medium text-white/50 hover:text-white/70 transition-colors"
            >
              Przejdź do logowania
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
