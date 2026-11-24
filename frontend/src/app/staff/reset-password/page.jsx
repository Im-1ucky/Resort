"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/services/api";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Missing reset token. Please request a new password reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      setSuccess(data.message);
      setTimeout(() => router.replace("/staff/login"), 1500);
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory p-6">
      <section className="w-full max-w-[440px] border border-[#e8e4db] bg-white p-8 shadow-xl sm:p-12">
        <div className="mb-5">
          <h1 className="font-display text-4xl text-forest">
            Choose new password
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Enter a new password of at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="new-password" className="mt-2 text-xs font-semibold">
            New password
          </label>
          <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
            <LockKeyhole size={18} className="shrink-0 text-stone-400" />
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-stone-400"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="confirm-password" className="mt-2 text-xs font-semibold">
            Confirm password
          </label>
          <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
            <LockKeyhole size={18} className="shrink-0 text-stone-400" />
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {success && <p className="mt-2 text-xs text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:opacity-60"
          >
            {submitting ? "SAVING..." : "UPDATE PASSWORD"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-ivory text-sm text-sage">
          Loading...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
