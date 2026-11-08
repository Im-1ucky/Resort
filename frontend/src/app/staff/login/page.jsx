
"use client";

import { useState } from "react";
import { useStaffAuth } from "@/components/Staff/StaffAuthProvider";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export default function StaffLoginPage() {
  const { login } = useStaffAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory p-6">
      <section className="w-full max-w-[440px] border border-[#e8e4db] bg-white p-8 shadow-xl sm:p-12">
        <div className="flex items-center gap-3 text-xs font-bold tracking-[3px] text-forest">
          <span className="grid size-9 place-items-center bg-forest font-display text-2xl text-white">
            E
          </span>
          THE ESTATE
        </div>

        <div className="mb-9 mt-14">
          <p className="text-[10px] font-bold tracking-[2.5px] text-wood">
            STAFF PORTAL
          </p>
          <h1 className="mt-3 font-display text-5xl text-forest">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Sign in to access your workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="staff-email" className="mt-2 text-xs font-semibold">
            Email address
          </label>
          <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
            <Mail size={18} className="shrink-0 text-stone-400" />
            <input
              id="staff-email"
              type="email"
              placeholder="name@theestate.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <label htmlFor="staff-password" className="mt-3 text-xs font-semibold">
            Password
          </label>
          <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
            <LockKeyhole size={18} className="shrink-0 text-stone-400" />
            <input
              id="staff-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="text-stone-400"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </form>

        <p className="mt-10 text-center text-[9px] tracking-[2px] text-stone-400">
          THE ESTATE · INTERNAL WORKSPACE
        </p>
      </section>
    </main>
  );
}
