"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function BookingPage() {
  const params = useSearchParams();

  const roomTypeId =
    params.get("roomTypeId") || params.get("id") || "";

  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    adults: Number(params.get("adults") || 2),
    children: Number(params.get("children") || 0),
    quantity: Number(params.get("quantity") || 1),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: ["adults", "children", "quantity"].includes(name)
        ? Number(value)
        : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!roomTypeId) {
        throw new Error("Room information is missing. Please select a room again.");
      }

      const result = await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          guestName: form.guestName.trim(),
          guestEmail: form.guestEmail.trim(),
          guestPhone: form.guestPhone.trim(),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: form.adults,
          children: form.children,
          items: [
            {
              roomTypeId,
              quantity: form.quantity,
            },
          ],
        }),
      });

      setBooking(result.booking);

      if (result.cancellationToken && result.booking?.id) {
        sessionStorage.setItem(
          `estate_cancel_${result.booking.id}`,
          result.cancellationToken
        );
      }

      try {
        await apiFetch(`/bookings/${result.booking.id}/pay`, {
          method: "POST",
          body: JSON.stringify({}),
        });

        setPaymentMessage(
          "Your booking is on hold and payment has been initiated. It is awaiting payment confirmation."
        );
      } catch {
        setPaymentMessage(
          "Your booking is on hold, but payment could not be initiated. Please contact the resort to complete your payment."
        );
      }
    } catch (err) {
      setError(err.message || "Unable to create your booking.");
    } finally {
      setLoading(false);
    }
  }

  if (booking) {
    return (
      <main className="min-h-screen bg-[var(--ivory)] px-5 py-24">
        <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[var(--olive)]">
            The Estate · Chikkamagaluru
          </p>
          <h1 className="font-[var(--font-display)] text-4xl text-[var(--forest)]">
            Booking received
          </h1>
          <p className="mt-4 text-gray-600">{paymentMessage}</p>

          <div className="mt-8 space-y-3 border-y border-gray-200 py-5">
            <p>
              <span className="text-gray-500">Booking reference:</span>{" "}
              <strong>{booking.id}</strong>
            </p>
            <p>
              <span className="text-gray-500">Guest:</span>{" "}
              {booking.guestName || form.guestName}
            </p>
            <p>
              <span className="text-gray-500">Check-in:</span> {form.checkIn}
            </p>
            <p>
              <span className="text-gray-500">Check-out:</span> {form.checkOut}
            </p>
          </div>

          <p className="mt-5 text-sm text-gray-500">
            Please save your booking reference. A pending booking hold is
            temporary and is not a confirmed paid reservation.
          </p>

          <a
            href="/my-bookings"
            className="mt-7 inline-block rounded-full bg-[var(--forest)] px-7 py-3 text-sm text-white"
          >
            View my bookings
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ivory)] px-5 pb-20 pt-32">
      <section className="mx-auto max-w-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--olive)]">
          The Estate · Chikkamagaluru
        </p>
        <h1 className="mt-3 font-[var(--font-display)] text-5xl text-[var(--forest)]">
          Complete your booking
        </h1>
        <p className="mt-3 text-gray-600">
          Enter your details to reserve your stay.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-9 space-y-6 rounded-2xl bg-white p-6 shadow-sm md:p-9"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              Full name
              <input
                required
                minLength={2}
                maxLength={100}
                name="guestName"
                value={form.guestName}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                placeholder="Your full name"
              />
            </label>

            <label className="text-sm text-gray-700">
              Email address
              <input
                required
                type="email"
                name="guestEmail"
                value={form.guestEmail}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                placeholder="you@example.com"
              />
            </label>
          </div>

          <label className="block text-sm text-gray-700">
            Phone number
            <input
              required
              type="tel"
              minLength={10}
              maxLength={15}
              name="guestPhone"
              value={form.guestPhone}
              onChange={updateField}
              className="mt-2 w-full rounded-lg border border-gray-300 p-3"
              placeholder="Your phone number"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              Check-in
              <input
                required
                type="date"
                name="checkIn"
                value={form.checkIn}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
              />
            </label>

            <label className="text-sm text-gray-700">
              Check-out
              <input
                required
                type="date"
                name="checkOut"
                min={form.checkIn || undefined}
                value={form.checkOut}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="text-sm text-gray-700">
              Adults
              <input
                required
                type="number"
                min="1"
                max="20"
                name="adults"
                value={form.adults}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
              />
            </label>

            <label className="text-sm text-gray-700">
              Children
              <input
                type="number"
                min="0"
                max="20"
                name="children"
                value={form.children}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
              />
            </label>

            <label className="text-sm text-gray-700">
              Rooms
              <input
                required
                type="number"
                min="1"
                max="10"
                name="quantity"
                value={form.quantity}
                onChange={updateField}
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--forest)] px-6 py-4 text-sm font-medium text-white transition hover:bg-[var(--forest-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing..." : "Reserve your stay"}
          </button>
        </form>
      </section>
    </main>
  );
}
