"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDashboardRoute } from "@/app/roles";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;
      if (!user) throw new Error("Brak użytkownika po zalogowaniu.");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      let role = profile?.role as string | undefined;

      if (!role) {
        const { data: createdProfile, error: insertError } = await supabase
          .from("user_profiles")
          .insert({ id: user.id, role: "employee" })
          .select("role")
          .single();

        if (insertError || !createdProfile?.role) {
          throw new Error(
            insertError?.message || "Nie udało się utworzyć profilu użytkownika."
          );
        }
        role = createdProfile.role;
      }

      router.push(getDashboardRoute(role!));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Błąd logowania.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
          Adres email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jan@restauracja.pl"
          className="w-full h-12 px-4 rounded-xl bg-white/90 border border-white/20 text-gray-900 placeholder-gray-400 text-[14px] focus:outline-none focus:border-amber-400/70 focus:bg-white transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40">
            Hasło
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-[12px] text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            Zapomniałeś hasła?
          </Link>
        </div>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Twoje hasło"
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
        disabled={isLoading}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[14px] font-bold text-white hover:from-amber-500 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-60"
      >
        {isLoading ? "Logowanie..." : <><span>Zaloguj się</span><ArrowRight className="w-4 h-4" /></>}
      </button>

      <p className="text-center text-[13px] text-white/30 pt-1">
        Nie masz konta?{" "}
        <Link href="/auth/sign-up" className="text-amber-400/80 hover:text-amber-400 transition-colors font-medium">
          Zarejestruj się
        </Link>
      </p>
    </form>
  );
}
