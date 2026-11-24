"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";
import { apiFetch } from "@/services/api";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export default function StaffLoginPage() {
  const { login, register } = useStaffAuth();
  const router = useRouter();

  const [mode, setMode] = useState("login"); // "login" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      let user;

      try {
        user = await login(email.trim(), password);
      } catch (err) {
        if (err.code !== "EMAIL_NOT_FOUND") {
          throw err;
        }

        user = await register(email.trim(), password);
        router.replace("/complete-profile");
        return;
      }

      switch (user?.role?.toUpperCase()) {
        case "ADMIN":
          router.replace("/staff/admin");
          break;

        case "GUEST":
          router.replace(
            !user.name || user.name === "Guest"
              ? "/complete-profile"
              : "/my-bookings"
          );
          break;

        default:
          router.replace("/staff/dashboard");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setDevResetUrl("");
    setSubmitting(true);

    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      setNotice(data.message);
      if (data.resetUrl) setDevResetUrl(data.resetUrl);
    } catch (err) {
      setError(err.message || "Unable to send reset link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory p-6">
      <section className="w-full max-w-[440px] border border-[#e8e4db] bg-white p-8 shadow-xl sm:p-12">
        {mode === "forgot" ? (
          <>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
                setDevResetUrl("");
              }}
              className="mb-4 flex items-center gap-2 text-xs text-stone-500 hover:text-forest"
            >
              <ArrowLeft size={15} /> Back to sign in
            </button>

            <div className="mb-5">
              <h1 className="font-display text-4xl text-forest">
                Reset password
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Enter your email address and we will send you a password reset link.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
              <label htmlFor="reset-email" className="mt-2 text-xs font-semibold">
                Email address
              </label>

              <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
                <Mail size={18} className="shrink-0 text-stone-400" />
                <input
                  id="reset-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              {notice && (
                <div className="mt-2 border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                  <p>{notice}</p>
                  {devResetUrl && (
                    <a
                      href={devResetUrl}
                      className="mt-2 block break-all font-semibold underline"
                    >
                      Open reset link
                    </a>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "SENDING..." : "SEND RESET LINK"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-5 mt-0">
              <h1 className="mt-3 font-display text-5xl text-forest">
                Welcome
              </h1>

              <p className="mt-2 text-sm text-stone-500">
                Sign in to access your account and bookings.
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <label htmlFor="login-email" className="mt-2 text-xs font-semibold">
                Email address
              </label>

              <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
                <Mail size={18} className="shrink-0 text-stone-400" />

                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                  }}
                  className="text-xs text-wood hover:text-forest"
                >
                  Forgot password?
                </button>
              </div>

              <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
                <LockKeyhole size={18} className="shrink-0 text-stone-400" />

                <input
                  id="login-password"
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
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-stone-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "SIGNING IN..." : "SIGN IN"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
