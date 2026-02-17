"use client";

import { useState } from "react";
// Link replaced by inline button for top navigation
import { useRouter } from "next/navigation";
import { applyLegacySessionFromProfile, loginWithEmailPassword } from "@/lib/authV2";

export default function LoginV2Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const profile = await loginWithEmailPassword(email.trim(), password);
      const { redirectTo } = applyLegacySessionFromProfile(profile);
      router.replace(redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#020617] text-white px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8">
        <div className="flex justify-start mb-3">
          <button
            onClick={() => router.push('/auth/login')}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            ← Go to current login
          </button>
        </div>
        <h1 className="text-2xl font-semibold mb-2 text-center">Secure Login (V2)</h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          New parallel login. Legacy PIN login remains available.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 block mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 block mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2"
              placeholder="••••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 py-2 font-medium"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        
      </div>
    </main>
  );
}
