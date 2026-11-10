
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";
import { apiFetch } from "@/services/api";
import { UserRound, Phone } from "lucide-react";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useStaffAuth();

  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/staff/login");
    }

    if (!loading && user && user.role !== "GUEST") {
      router.replace(
        user.role === "ADMIN" ? "/staff/admin" : "/staff/dashboard"
      );
    }
  }, [user, loading, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

      await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          phone: fullPhone,
        }),
      });

      await refreshUser();
      router.replace("/my-bookings");
    } catch (err) {
      setError(err.message || "Unable to save your profile.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user || user.role !== "GUEST") {
    return null;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ivory p-6">
      <section className="w-full max-w-[440px] border border-[#e8e4db] bg-white p-8 shadow-xl sm:p-12">
        <div className="mb-7">
          <h1 className="mt-0 font-display text-4xl text-forest">
            Hi, new user!
          </h1>

          <p className="mt-2 text-sm text-stone-500">
            Let's complete your profile before you explore your bookings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="mt-2 text-xs font-semibold">
            Full name
          </label>

          <div className="flex min-h-12 items-center gap-3 border border-[#e5e2da] px-3 focus-within:border-forest">
            <UserRound size={18} className="shrink-0 text-stone-400" />

            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <label className="mt-2 text-xs font-semibold">
            Phone number
          </label>

          <div className="flex min-h-12 items-center border border-[#e5e2da] focus-within:border-forest">
            <Phone size={18} className="ml-3 shrink-0 text-stone-400" />

            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              aria-label="Country calling code"
              className="h-full max-w-[105px] bg-transparent px-2 text-sm outline-none"
            >
              <option value="+91">+91 (IN)</option>
              <option value="+1">+1 (US/CA)</option>
              <option value="+44">+44 (UK)</option>
              <option value="+61">+61 (AU)</option>
              <option value="+971">+971 (UAE)</option>
              <option value="+966">+966 (SA)</option>
              <option value="+65">+65 (SG)</option>
              <option value="+60">+60 (MY)</option>
              <option value="+49">+49 (DE)</option>
              <option value="+33">+33 (FR)</option>
            </select>

            <span className="h-6 w-px bg-[#e5e2da]" />

            <input
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/[^\d]/g, ""))
              }
              autoComplete="tel-national"
              inputMode="numeric"
              required
              className="min-w-0 w-full bg-transparent px-3 text-sm outline-none"
            />
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 min-h-12 bg-forest text-xs font-semibold tracking-widest text-white transition hover:bg-forest-dark disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "SAVING..." : "COMPLETE PROFILE"}
          </button>
        </form>
      </section>
    </main>
  );
}
