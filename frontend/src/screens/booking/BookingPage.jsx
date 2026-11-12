"use client";

import { useEffect, useState } from "react";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/services/api";
import {
  formatIndianDate,
  parseIndianDate,
  formatApiDate,
} from "@/utils/date";

export default function BookingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useStaffAuth();

  const roomTypeId =
    params.get("roomTypeId") || params.get("id") || "";

  const [promoCode, setPromoCode] = useState("");

  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: formatIndianDate(params.get("checkIn") || ""),
    checkOut: formatIndianDate(params.get("checkOut") || ""),
    adults: Number(params.get("adults") || 2),
    children: Number(params.get("children") || 0),
    quantity: Number(params.get("quantity") || 1),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: ["adults", "children", "quantity"].includes(name)
        ? Number(value)
        : value,
    }));
  }

  useEffect(() => {
    if (!user) return;

    setForm((current) => ({
      ...current,
      guestName:
        user.name && user.name !== "Guest"
          ? user.name
          : current.guestName,
      guestEmail: user.email || current.guestEmail,
      guestPhone: user.phone || current.guestPhone,
    }));
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!roomTypeId) {
      setError("Room information is missing. Please select a room again.");
      return;
    }

    if (!form.guestName.trim() || form.guestName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.guestEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^\+?[0-9\s-]{10,15}$/.test(form.guestPhone.trim())) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (!form.checkIn || !form.checkOut) {
      setError("Please select your check-in and check-out dates.");
      return;
    }

    const checkInDate = parseIndianDate(form.checkIn);
    const checkOutDate = parseIndianDate(form.checkOut);

    if (!checkInDate || !checkOutDate) {
      setError("Enter valid dates in DD/MM/YYYY format.");
      return;
    }

    const checkInISO = formatApiDate(checkInDate);
    const checkOutISO = formatApiDate(checkOutDate);

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    if (checkInISO < today) {
      setError("Check-in cannot be in the past.");
      return;
    }

    if (checkOutISO <= checkInISO) {
      setError("Check-out must be after check-in.");
      return;
    }

    if (
      !Number.isInteger(form.adults) ||
      form.adults < 1 ||
      form.adults > 20 ||
      !Number.isInteger(form.children) ||
      form.children < 0 ||
      form.children > 20 ||
      !Number.isInteger(form.quantity) ||
      form.quantity < 1 ||
      form.quantity > 10
    ) {
      setError("Please enter valid guest and room quantities.");
      return;
    }

    setLoading(true);

    try {
      const result = await apiFetch("/bookings", {
        method: "POST",
        body: JSON.stringify({
          guestName: form.guestName.trim(),
          guestEmail: form.guestEmail.trim(),
          guestPhone: form.guestPhone.trim(),
          checkIn: checkInISO,
          checkOut: checkOutISO,
          adults: form.adults,
          children: form.children,
          promoCode: promoCode.trim() || undefined,
          items: [
            {
              roomTypeId,
              quantity: form.quantity,
            },
          ],
        }),
      });

      if (!result.booking?.id) {
        throw new Error("Booking was created, but no booking reference was returned.");
      }

      const createdBooking = result.booking;

      // Save booking details and server-calculated pricing.
      const bookingData = {
        id: createdBooking.id,
        guestName: createdBooking.guestName,
        guestEmail: createdBooking.guestEmail,
        guestPhone: createdBooking.guestPhone,
        checkIn: checkInISO,
        checkOut: checkOutISO,
        adults: form.adults,
        children: form.children,
        quantity: form.quantity,
        subtotal: createdBooking.subtotal,
        discountAmount: createdBooking.discountAmount,
        gstAmount: createdBooking.gstAmount,
        totalAmount: createdBooking.totalAmount,
      };

      sessionStorage.setItem(
        `estate_booking_${createdBooking.id}`,
        JSON.stringify(bookingData)
      );

      if (result.cancellationToken) {
        sessionStorage.setItem(
          `estate_cancel_${createdBooking.id}`,
          result.cancellationToken
        );
      }

      router.push(
        `/payment?bookingId=${encodeURIComponent(createdBooking.id)}`
      );
    } catch (err) {
      setError(err.message || "Unable to create your booking.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ivory)] px-5 pb-10 pt-12">
      <section className="mx-auto max-w-2xl">
        <h1 className="mt-3 font-[var(--font-display)] text-5xl text-[var(--forest)]">
          Complete your booking
        </h1>

        <p className="mt-3 text-gray-600">
          Enter your details and review your stay before proceeding to payment.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-5 rounded-2xl bg-white p-0 pb-0 shadow-sm md:p-4 md:pb-0"
        >
          {/* Guest details */}
          <div>
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
                  autoComplete="name"
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
                  autoComplete="email"
                  className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <label className="mt-5 block text-sm text-gray-700">
              Phone number
              <input
                required
                type="tel"
                minLength={10}
                maxLength={15}
                name="guestPhone"
                value={form.guestPhone}
                onChange={updateField}
                autoComplete="tel"
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                placeholder="Your phone number"
              />
            </label>
          </div>

          {/* Stay details */}
          <div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm text-gray-700">
                Check-in
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
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
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  name="checkOut"
                  value={form.checkOut}
                  onChange={updateField}
                  className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
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
          </div>

          {/* Promo code - OPTIONAL */}
          <div>
            <h2 className="mb-3 text-lg font-medium text-[var(--forest)]">
              Promo code
            </h2>

            <input
              type="text"
              value={promoCode}
              onChange={(event) =>
                setPromoCode(event.target.value.toUpperCase())
              }
              maxLength={30}
              placeholder="Enter promo code (optional)"
              className="w-full rounded-lg border border-gray-300 p-3 uppercase"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* NEXT BUTTON */}
          <div className="mt-8 block w-full">
            <button
              type="submit"
              disabled={loading}
              style={{ display: "block", visibility: "visible" }}
              className="min-h-14 w-full cursor-pointer rounded-full bg-[#203c30] px-6 py-4 text-base font-semibold text-white hover:bg-[#162c22] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating booking..." : "NEXT"}
            </button>
          </div>

          {/* Next */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--forest)] px-6 py-4 text-sm font-medium text-white transition hover:bg-[var(--forest-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating booking..." : "Next"}
          </button>
        </form>
      </section>
    </main>
  );
}
