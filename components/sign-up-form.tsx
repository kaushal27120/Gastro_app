"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export function SignUpForm() {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError("Podaj nazwę firmy.");
      return;
    }
    if (password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (password !== repeatPassword) {
      setError("Hasła się nie zgadzają.");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
        },
      });
      if (error) throw error;

      const user = data.user;
      if (user) {
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .insert({ name: companyName.trim() })
          .select("id")
          .single();

        if (companyError) throw companyError;

        await supabase.from("user_profiles").upsert({
          id: user.id,
          role: "owner",
          company_id: (company as any).id,
        });
      }

      router.push("/auth/sign-up-success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Błąd rejestracji.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
          Nazwa firmy / restauracji
        </label>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="np. Pizzeria da Marco"
          className="w-full h-12 px-4 rounded-xl bg-white/90 border border-white/20 text-gray-900 placeholder-gray-400 text-[14px] focus:outline-none focus:border-amber-400/70 focus:bg-white transition-all"
        />
      </div>

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
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
          Hasło
        </label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
          Powtórz hasło
        </label>
        <div className="relative">
          <input
            type={showPw2 ? "text" : "password"}
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            placeholder="Powtórz hasło"
            className="w-full h-12 px-4 pr-12 rounded-xl bg-white/90 border border-white/20 text-gray-900 placeholder-gray-400 text-[14px] focus:outline-none focus:border-amber-400/70 focus:bg-white transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw2(!showPw2)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPw2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
        {isLoading ? "Tworzenie konta..." : <><span>Utwórz konto</span><ArrowRight className="w-4 h-4" /></>}
      </button>

      <p className="text-center text-[13px] text-white/30 pt-1">
        Masz już konto?{" "}
        <Link href="/auth/login" className="text-amber-400/80 hover:text-amber-400 transition-colors font-medium">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}
