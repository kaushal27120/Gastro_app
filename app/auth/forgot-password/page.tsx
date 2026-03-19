import { ForgotPasswordForm } from "@/components/forgot-password-form";
import Link from "next/link";
import { OneLinkLogo } from "@/components/onelink-logo";

export default function ForgotPasswordPage() {
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
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(245,158,11,0.06) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[420px] mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-10">
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
            <h2 className="text-[24px] font-bold text-white mb-1">Resetuj hasło</h2>
            <p className="text-[13px] text-white/40">Wyślemy Ci link do zmiany hasła</p>
          </div>
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-[12px] text-white/20 mt-6">
          <Link href="/auth/login" className="hover:text-white/40 transition-colors">
            ← Wróć do logowania
          </Link>
        </p>
      </div>
    </main>
  );
}
