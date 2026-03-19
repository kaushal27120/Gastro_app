"use client";

import { useRouter } from "next/navigation";
import { XCircle, ArrowRight, RefreshCw } from "lucide-react";
import { OneLinkLogo } from "@/components/onelink-logo";

export default function BillingCancelPage() {
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
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(239,68,68,0.06) 0%, transparent 70%)" }}
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

          {/* Cancel icon */}
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>

          <h1 className="text-[28px] font-bold text-white mb-3">Płatność anulowana</h1>
          <p className="text-[14px] text-white/50 leading-relaxed mb-8">
            Nie dokończyłeś procesu płatności. Twoja subskrypcja nie została aktywowana. Możesz spróbować ponownie w dowolnym momencie.
          </p>

          <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/15 mb-8">
            <p className="text-[13px] text-amber-400/80">
              Pamiętaj — 7-dniowy trial jest w pełni funkcjonalny. Nie stracisz nic, próbując ponownie.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[14px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Spróbuj ponownie</span>
            </button>
            <button
              onClick={() => router.push("/auth/login")}
              className="w-full h-11 rounded-xl text-[14px] font-medium text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-2"
            >
              <span>Wróć do logowania</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
