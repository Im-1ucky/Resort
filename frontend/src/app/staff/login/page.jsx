
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/components/Staff/StaffAuthProvider";
import { apiFetch } from "@/lib/api";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export default function StaffLoginPage() {
  const { login } = useStaffAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [accountType, setAccountType] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await apiFetch("/guest/identify", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      if (result.accountType === "STAFF") {
        setAccountType("STAFF");
      } else {
        const otpResult = await apiFetch("/guest/otp/request", {
          method: "POST",
          body: JSON.stringify({ identifier: email.trim() }),
        });

        setAccountType("GUEST");
        setDemoOtp(otpResult.demoOtp || "");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStaffLogin(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const authenticatedUser = await login(email.trim(), password);

      if (authenticatedUser?.role === "ADMIN") {
        router.replace("/staff/admin");
      } else {
        router.replace("/staff/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuestVerification(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await apiFetch("/guest/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          identifier: email.trim(),
          otp,
        }),
      });

      sessionStorage.setItem("guestToken", result.guestToken);
      router.replace("/my-bookings");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetLogin() {
    setAccountType("");
    setPassword("");
    setOtp("");
    setDemoOtp("");
    setError("");
    setShowPassword(false);
  }

  const isStaff = accountType === "STAFF";
  const isGuest = accountType === "GUEST";

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
            {isStaff
              ? "STAFF & ADMIN PORTAL"
              : isGuest
                ? "GUEST PORTAL"
                : "ACCOUNT LOGIN"}
          </p>

          <h1 className="mt-3 font-display text-5xl text-forest">
            Welcome back.
          </h1>

          <p className="mt-2 text-sm text-stone-500">
            {isStaff
              ? "Sign in to access your workspace."
              : isGuest
                ? "Verify your email to access your bookings."
                : "Enter your email address to continue."}
          </p>
        </div>

        {!accountType ? (
          <form onSubmit={handleContinue} className="flex flex-col gap-3">
            <label
              htmlFor="login-email"
              className="mt-2 text-xs font-semibold"
            >
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

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "PLEASE WAIT..." : "CONTINUE"}
            </button>
          </form>
        ) : isStaff ? (
          <form onSubmit={handleStaffLogin} className="flex flex-col gap-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="truncate text-stone-500">{email}</span>

              <button
                type="button"
                onClick={resetLogin}
                className="shrink-0 text-wood underline"
              >
                Change
              </button>
            </div>

            <label
              htmlFor="staff-password"
              className="mt-2 text-xs font-semibold"
            >
              Password
            </label>

            <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
              <LockKeyhole
                size={18}
                className="shrink-0 text-stone-400"
              />

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
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
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
        ) : (
          <form
            onSubmit={handleGuestVerification}
            className="flex flex-col gap-3"
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="truncate text-stone-500">{email}</span>

              <button
                type="button"
                onClick={resetLogin}
                className="shrink-0 text-wood underline"
              >
                Change
              </button>
            </div>

            <label
              htmlFor="guest-otp"
              className="mt-2 text-xs font-semibold"
            >
              Six-digit OTP
            </label>

            <input
              id="guest-otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, ""))
              }
              required
              className="min-h-12 border border-[#e5e2da] px-3 text-center text-lg tracking-[0.5em] outline-none focus:border-forest"
            />

            {demoOtp && (
              <p className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Demo OTP: <strong>{demoOtp}</strong>
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "VERIFYING..." : "VERIFY OTP"}
            </button>
          </form>
        )}

        <p className="mt-10 text-center text-[9px] tracking-[2px] text-stone-400">
          THE ESTATE ·{" "}
          {isStaff ? "INTERNAL WORKSPACE" : "CHIKKAMAGALURU"}
        </p>
      </section>
    </main>
  );
}
