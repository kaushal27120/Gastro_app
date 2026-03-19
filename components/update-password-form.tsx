"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Hasło musi mieć co najmniej 8 znaków."); return; }
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Błąd aktualizacji hasła.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <p className="text-[14px] text-white/60">Hasło zostało zmienione. Przekierowanie do logowania...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
          Nowe hasło
        </label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 znaków"
            className="w-full h-12 px-4 pr-12 rounded-xl bg-white/90 border border-white/20 text-gray-900 placeholder-gray-400 text-[14px] focus:outline-none focus:border-amber-400/70 focus:bg-white transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
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
        {loading ? "Zapisywanie..." : <><span>Zapisz nowe hasło</span><ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  );
}
