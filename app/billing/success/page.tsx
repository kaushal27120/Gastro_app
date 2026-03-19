"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { OneLinkLogo } from "@/components/onelink-logo";

function BillingSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");

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
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(34,197,94,0.08) 0%, transparent 70%)" }}
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

          <h1 className="text-[28px] font-bold text-white mb-3">Subskrypcja aktywna!</h1>
          <p className="text-[14px] text-white/50 leading-relaxed mb-8">
            Dziękujemy! Twoja płatność została przetworzona. Masz pełny dostęp do platformy przez 7 dni trialu, a następnie subskrypcja przedłuży się automatycznie.
          </p>

          {/* Feature highlights */}
          <div className="space-y-2.5 mb-8 text-left">
            {[
              "Pełny dostęp do panelu właściciela",
              "Raporty sprzedaży i P&L w czasie rzeczywistym",
              "Zarządzanie magazynem i zespołem",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2.5 text-[13px] text-white/60">
                <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5 text-green-400" stroke="currentColor" strokeWidth="2">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                </div>
                {feat}
              </div>
            ))}
          </div>

          {sessionId && (
            <p className="text-[11px] text-white/20 font-mono mb-6 break-all">
              ID sesji: {sessionId}
            </p>
          )}

          <button
            onClick={() => router.push("/admin")}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[14px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
          >
            <Sparkles className="w-4 h-4" />
            <span>Przejdź do panelu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense>
      <BillingSuccessContent />
    </Suspense>
  );
}
