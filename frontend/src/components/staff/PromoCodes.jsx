"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  Ban,
  CheckCircle,
  TicketPercent,
  Users,
  Tag,
} from "lucide-react";
import { apiFetch } from "@/services/api";

const initialForm = {
  code: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minBookingAmount: "0",
  startsAt: "",
  expiresAt: "",
  maxUses: "",
};

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getPromoStatus(promo) {
  const now = new Date();

  if (!promo.isActive) return "Disabled";
  if (now < new Date(promo.startsAt)) return "Upcoming";
  if (now > new Date(promo.expiresAt)) return "Expired";

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return "Exhausted";
  }

  return "Active";
}

function Stat({ title, value, icon: Icon }) {
  return (
    <div className="border border-[#e8e4db] bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500">{title}</span>
        <Icon size={18} className="text-wood" />
      </div>
      <p className="mt-4 font-display text-3xl text-forest">{value}</p>
    </div>
  );
}

export default function PromoCodes() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);

  const loadPromos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/promos");
      setPromos(data.promos || []);
    } catch (err) {
      setError(err.message || "Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createPromo(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.startsAt || !form.expiresAt) {
      setError("Please select both start and expiry dates.");
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minBookingAmount: Number(form.minBookingAmount),
      startsAt: new Date(form.startsAt).toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      maxUses: form.maxUses === "" ? null : Number(form.maxUses),
    };

    if (
      !payload.code ||
      !Number.isFinite(payload.discountValue) ||
      payload.discountValue <= 0 ||
      !Number.isFinite(payload.minBookingAmount) ||
      payload.minBookingAmount < 0 ||
      (payload.maxUses !== null &&
        (!Number.isInteger(payload.maxUses) || payload.maxUses <= 0))
    ) {
      setError("Please enter valid promo details.");
      return;
    }

    setSaving(true);

    try {
      await apiFetch("/promos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setForm(initialForm);
      setShowForm(false);
      setSuccess("Promo code created successfully.");
      await loadPromos();
    } catch (err) {
      setError(err.message || "Failed to create promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePromo(promo) {
    setError("");
    setSuccess("");

    try {
      await apiFetch(`/promos/${promo.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !promo.isActive }),
      });

      setSuccess(
        `Promo code ${promo.isActive ? "disabled" : "enabled"} successfully.`
      );
      await loadPromos();
    } catch (err) {
      setError(err.message || "Failed to update promo code.");
    }
  }

  const totalRedemptions = promos.reduce(
    (total, promo) => total + promo.usedCount,
    0
  );

  const activePromos = promos.filter(
    (promo) => getPromoStatus(promo) === "Active"
  ).length;

  const exhaustedPromos = promos.filter(
    (promo) => getPromoStatus(promo) === "Exhausted"
  ).length;

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-forest">
            Promo codes
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Create, monitor and manage promotional discounts.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadPromos}
            disabled={loading}
            className="grid size-10 place-items-center border border-[#dedbd2] text-forest hover:bg-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setSuccess("");
            }}
            className="flex items-center gap-2 bg-forest px-5 py-3 text-xs font-semibold text-white hover:bg-forest-dark"
          >
            <Plus size={15} />
            Create promo
          </button>
        </div>
      </div>

      {error && (
        <p className="border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p className="border border-green-100 bg-green-50 p-3 text-xs text-green-700">
          {success}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Total promo codes" value={promos.length} icon={Tag} />
        <Stat title="Currently active" value={activePromos} icon={CheckCircle} />
        <Stat title="Total redemptions" value={totalRedemptions} icon={Users} />
        <Stat title="Exhausted codes" value={exhaustedPromos} icon={TicketPercent} />
      </div>

      {showForm && (
        <form
          onSubmit={createPromo}
          className="space-y-5 border border-[#e8e4db] bg-white p-5"
        >
          <h3 className="font-display text-2xl text-forest">
            Create a promo code
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Promo code">
              <input
                name="code"
                required
                minLength={3}
                maxLength={30}
                value={form.code}
                onChange={updateField}
                placeholder="SUMMER20"
                className="field"
              />
            </Field>

            <Field label="Discount type">
              <select
                name="discountType"
                value={form.discountType}
                onChange={updateField}
                className="field"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Flat amount (₹)</option>
              </select>
            </Field>

            <Field label="Discount value">
              <input
                name="discountValue"
                type="number"
                required
                min="0.01"
                step="0.01"
                max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                value={form.discountValue}
                onChange={updateField}
                placeholder={form.discountType === "PERCENTAGE" ? "20" : "500"}
                className="field"
              />
            </Field>

            <Field label="Minimum booking amount (₹)">
              <input
                name="minBookingAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.minBookingAmount}
                onChange={updateField}
                className="field"
              />
            </Field>

            <Field label="Maximum redemptions">
              <input
                name="maxUses"
                type="number"
                min="1"
                step="1"
                value={form.maxUses}
                onChange={updateField}
                placeholder="Unlimited"
                className="field"
              />
            </Field>

            <Field label="Starts at">
              <input
                name="startsAt"
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={updateField}
                className="field"
              />
            </Field>

            <Field label="Expires at">
              <input
                name="expiresAt"
                type="datetime-local"
                required
                value={form.expiresAt}
                onChange={updateField}
                className="field"
              />
            </Field>
          </div>

          <p className="text-[11px] text-stone-400">
            Leave maximum redemptions empty for unlimited use.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-forest px-6 py-3 text-xs font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create promo code"}
            </button>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-[#dedbd2] px-6 py-3 text-xs text-stone-600 hover:bg-ivory"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="border border-[#e8e4db] bg-white">
        <div className="border-b border-[#eeeae2] p-5">
          <h3 className="font-display text-2xl text-forest">
            All promo codes
          </h3>
          <p className="mt-1 text-[10px] text-stone-400">
            Redemption count reflects the backend&apos;s current used count.
          </p>
        </div>

        {loading ? (
          <p className="p-10 text-center text-xs text-stone-400">
            Loading promo codes...
          </p>
        ) : promos.length === 0 ? (
          <p className="p-10 text-center text-xs text-stone-400">
            No promo codes created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-[#eeeae2] bg-ivory/60 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-5 py-4">Code</th>
                  <th className="px-5 py-4">Discount</th>
                  <th className="px-5 py-4">Redemptions</th>
                  <th className="px-5 py-4">Minimum bill</th>
                  <th className="px-5 py-4">Validity</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {promos.map((promo) => {
                  const status = getPromoStatus(promo);
                  const remaining =
                    promo.maxUses === null
                      ? "Unlimited"
                      : Math.max(0, promo.maxUses - promo.usedCount);

                  return (
                    <tr
                      key={promo.id}
                      className="border-b border-[#eeeae2] last:border-0"
                    >
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold text-forest">
                          {promo.code}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        {promo.discountType === "PERCENTAGE"
                          ? `${promo.discountValue}%`
                          : formatCurrency(promo.discountValue)}
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <p className="font-semibold">
                          {promo.usedCount} used
                        </p>
                        <p className="mt-1 text-[10px] text-stone-400">
                          {remaining} remaining
                        </p>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        {formatCurrency(promo.minBookingAmount)}
                      </td>

                      <td className="px-5 py-4 text-[10px] text-stone-500">
                        <p>{new Date(promo.startsAt).toLocaleDateString()}</p>
                        <p className="mt-1">
                          to {new Date(promo.expiresAt).toLocaleDateString()}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-[10px] font-semibold ${
                            status === "Active"
                              ? "text-green-700"
                              : status === "Disabled" ||
                                  status === "Expired" ||
                                  status === "Exhausted"
                                ? "text-red-600"
                                : "text-amber-700"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => togglePromo(promo)}
                          disabled={status === "Expired" || status === "Exhausted"}
                          className="flex items-center gap-2 text-xs font-semibold text-forest hover:text-wood disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {promo.isActive ? (
                            <>
                              <Ban size={14} />
                              Disable
                            </>
                          ) : (
                            <>
                              <CheckCircle size={14} />
                              Enable
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .field {
          width: 100%;
          height: 44px;
          border: 1px solid #dedbd2;
          background: white;
          padding: 0 12px;
          font-size: 12px;
          outline: none;
        }

        .field:focus {
          border-color: #315443;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-coffee">
        {label}
      </span>
      {children}
    </label>
  );
}
