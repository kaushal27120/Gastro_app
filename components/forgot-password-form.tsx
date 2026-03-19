"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Mail, CheckCircle2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Błąd. Sprawdź adres email i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-white mb-2">Sprawdź skrzynkę</h3>
          <p className="text-[13px] text-white/45 leading-relaxed">
            Wysłaliśmy link do resetowania hasła na adres <span className="text-white/70 font-medium">{email}</span>. Sprawdź też folder spam.
          </p>
        </div>
        <Link href="/auth/login" className="block text-[13px] text-amber-400 hover:text-amber-300 font-medium transition-colors">
          ← Wróć do logowania
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
          Adres email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jan@restauracja.pl"
          className="w-full h-12 px-4 rounded-xl bg-white/90 border border-white/20 text-gray-900 placeholder-gray-400 text-[14px] focus:outline-none focus:border-amber-400/70 focus:bg-white transition-all"
        />
      </div>

      {error && (
        <div className="text-[12px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[14px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-60"
      >
        {loading ? "Wysyłanie..." : <><Mail className="w-4 h-4" /><span>Wyślij link resetujący</span></>}
      </button>

      <p className="text-center text-[13px] text-white/30 pt-1">
        <Link href="/auth/login" className="text-white/50 hover:text-amber-400 transition-colors">
          ← Wróć do logowania
        </Link>
      </p>
    </form>
  );
}
