"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/services/api";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";
import {
  CalendarDays,
  Clock3,
  MapPin,
  ArrowLeft,
} from "lucide-react";

const cancellableStatuses = ["PENDING_PAYMENT", "CONFIRMED"];

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getBookingGroup(booking) {
  if (booking.status === "CANCELLED") return "cancelled";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkOut = new Date(
    `${String(booking.checkOut).slice(0, 10)}T00:00:00`
  );

  if (checkOut <= today) return "past";

  return "upcoming";
}

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: "bg-green-50 text-green-700",
    PENDING_PAYMENT: "bg-amber-50 text-amber-700",
    CANCELLED: "bg-red-50 text-red-700",
    FAILED: "bg-gray-100 text-gray-600",
    EXPIRED: "bg-gray-100 text-gray-600",
    PAYMENT_REVIEW: "bg-orange-50 text-orange-700",
  };

  const labels = {
    CONFIRMED: "Confirmed",
    PENDING_PAYMENT: "Payment pending",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
    EXPIRED: "Expired",
    PAYMENT_REVIEW: "Payment under review",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {labels[status] || status?.replaceAll("_", " ")}
    </span>
  );
}

function BookingCard({ booking, onCancel, onRequestOtp, onVerifyOtp }) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [guestToken, setGuestToken] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [error, setError] = useState("");

  const roomNames = booking.items
    ?.map((item) => `${item.quantity} × ${item.roomType?.name || "Room"}`)
    .join(", ");

  async function handleRequestOtp() {
    setRequestingOtp(true);
    setError("");

    try {
      const result = await onRequestOtp();
      setOtpSent(true);
      setDemoOtp(result.demoOtp || "");
    } catch (err) {
      setError(err.message || "Unable to send verification code.");
    } finally {
      setRequestingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    setVerifyingOtp(true);
    setError("");

    try {
      const result = await onVerifyOtp(otp);
      setGuestToken(result.guestToken);
    } catch (err) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError("");

    try {
      await onCancel(booking.id, guestToken);
      setConfirming(false);
    } catch (err) {
      setError(err.message || "Unable to cancel booking.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[#e8e1d8] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#9a826b]">
            Booking reference
          </p>
          <h3 className="mt-1 font-semibold text-[#332A23]">
            {booking.id.slice(0, 8).toUpperCase()}
          </h3>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="my-5 grid gap-4 border-y border-[#eee8e0] py-5 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 text-[#9a826b]" size={18} />
          <div>
            <p className="text-xs text-[#8b8075]">Check-in</p>
            <p className="mt-1 text-sm font-medium text-[#332A23]">
              {formatDate(booking.checkIn)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 text-[#9a826b]" size={18} />
          <div>
            <p className="text-xs text-[#8b8075]">Check-out</p>
            <p className="mt-1 text-sm font-medium text-[#332A23]">
              {formatDate(booking.checkOut)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm text-[#65594e]">
        <p className="flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-[#9a826b]" />
          {roomNames || "Room details unavailable"}
        </p>
        <p>
          {booking.adults} adults
          {booking.children > 0 ? ` · ${booking.children} children` : ""}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee8e0] pt-5">
        <div>
          <p className="text-xs text-[#8b8075]">Total amount</p>
          <p className="mt-1 text-lg font-semibold text-[#332A23]">
            {formatMoney(booking.totalAmount)}
          </p>
        </div>

        {cancellableStatuses.includes(booking.status) &&
          getBookingGroup(booking) === "upcoming" && (
            <button
              onClick={() => {
                setConfirming(true);
                setError("");
              }}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              Cancel booking
            </button>
          )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {confirming && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50/60 p-4">
          <h4 className="font-semibold text-[#49352e]">
            Cancel this reservation?
          </h4>

          <p className="mt-2 text-sm leading-6 text-[#76645c]">
            This will cancel your booking. Any applicable refund must be
            handled according to the resort's payment and cancellation policy.
          </p>

          {!otpSent ? (
            <button
              onClick={handleRequestOtp}
              disabled={requestingOtp}
              className="mt-4 rounded-lg bg-[#382e26] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {requestingOtp ? "Sending OTP..." : "Verify with email OTP"}
            </button>
          ) : !guestToken ? (
            <>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[#65594e]">
                  Enter the verification code sent to your registered email.
                </p>

                {demoOtp && (
                  <p className="text-xs text-amber-700">
                    Demo OTP: {demoOtp}
                  </p>
                )}

                <input
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit OTP"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-lg border border-[#ded2c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#9a826b]"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otp.length !== 6}
                    className="rounded-lg bg-[#382e26] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {verifyingOtp ? "Verifying..." : "Verify OTP"}
                  </button>

                  <button
                    onClick={handleRequestOtp}
                    disabled={requestingOtp}
                    className="text-sm text-[#65594e] underline disabled:opacity-60"
                  >
                    {requestingOtp ? "Resending..." : "Resend OTP"}
                  </button>
                </div>

                <button
                  onClick={() => setConfirming(false)}
                  disabled={verifyingOtp || requestingOtp}
                  className="rounded-lg border border-[#ded2c8] bg-white px-4 py-2.5 text-sm font-medium text-[#65594e]"
                >
                  Keep booking
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <p className="mb-3 text-sm font-medium text-green-700">
                Email verified successfully.
              </p>

              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Confirm cancellation"}
              </button>
            </div>
          )}

          {!otpSent && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setConfirming(false)}
                disabled={cancelling || requestingOtp || verifyingOtp}
                className="rounded-lg border border-[#ded2c8] bg-white px-4 py-2.5 text-sm font-medium text-[#65594e]"
              >
                Keep booking
              </button>
            </div>
          )}

          {otpSent && guestToken && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setConfirming(false)}
                disabled={cancelling}
                className="rounded-lg border border-[#ded2c8] bg-white px-4 py-2.5 text-sm font-medium text-[#65594e]"
              >
                Keep booking
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function MyBookingsPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useStaffAuth();

  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      router.replace("/staff/login");
      return;
    }

    if (user.role?.toUpperCase() !== "GUEST") {
      router.replace(
        user.role?.toUpperCase() === "ADMIN"
          ? "/staff/admin"
          : "/staff/dashboard"
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await apiFetch("/guest/bookings");

      setBookings(result.bookings || []);
    } catch (err) {
      setError(err.message || "Unable to load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading) {
      loadBookings();
    }
  }, [authLoading, loadBookings]);

  const groupedBookings = useMemo(() => {
    return {
      upcoming: bookings.filter(
        (b) => getBookingGroup(b) === "upcoming"
      ),
      past: bookings.filter(
        (b) => getBookingGroup(b) === "past"
      ),
      cancelled: bookings.filter(
        (b) => getBookingGroup(b) === "cancelled"
      ),
    };
  }, [bookings]);

  const visibleBookings = groupedBookings[activeTab];

  async function requestGuestOtp() {
    return apiFetch("/guest/otp/request", {
      method: "POST",
      body: JSON.stringify({
        identifier: user.email,
      }),
    });
  }

  async function verifyGuestOtp(otp) {
    return apiFetch("/guest/otp/verify", {
      method: "POST",
      body: JSON.stringify({
        identifier: user.email,
        otp,
      }),
    });
  }

  async function cancelBooking(id, guestToken) {
    await apiFetch(`/bookings/${id}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${guestToken}`,
      },
      body: JSON.stringify({}),
    });

    await loadBookings();
  }

  const tabs = [
    { id: "upcoming", label: "Current" },
    { id: "past", label: "Past stays" },
    { id: "cancelled", label: "Cancelled" },
  ];

  if (authLoading || !user || user.role?.toUpperCase() !== "GUEST") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#82776c]">
        Loading your account...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 pb-20 pt-28 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a826b]">
              The Estate
            </p>

            <h1 className="mt-2 font-display text-3xl text-[#332A23] sm:text-4xl">
              My Bookings
            </h1>

            <p className="mt-2 text-sm text-[#82776c]">
              Manage your reservations and revisit your stays.
            </p>
          </div>

          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#ded6cb] px-4 py-2.5 text-sm font-medium text-[#65594e] hover:bg-white"
          >
            <ArrowLeft size={16} />
            Back to home
          </button>
        </div>

        <div className="mt-9 flex gap-2 overflow-x-auto border-b border-[#ded6cb]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-coffee text-coffee"
                  : "border-transparent text-[#82776c] hover:text-coffee"
              }`}
            >
              {tab.label}

              <span className="ml-2 text-xs opacity-70">
                {groupedBookings[tab.id].length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-[#82776c]">
            Loading your bookings...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}

            <button
              onClick={loadBookings}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[#e8e1d8] bg-white px-6 py-16 text-center">
            <CalendarDays className="mx-auto text-[#b4a797]" size={34} />

            <h2 className="mt-4 font-display text-xl text-[#332A23]">
              {activeTab === "upcoming"
                ? "No current bookings"
                : activeTab === "past"
                  ? "No past stays yet"
                  : "No cancelled bookings"}
            </h2>

            <p className="mt-2 text-sm text-[#82776c]">
              {activeTab === "upcoming"
                ? "Your current reservations"
                : "Your booking history will appear here."}
            </p>

            <a
              href="/"
              className="mt-6 inline-flex rounded-xl bg-coffee px-5 py-3 text-sm font-medium !text-white hover:bg-coffee-dark"
            >
              Explore rooms
            </a>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={cancelBooking}
                onRequestOtp={requestGuestOtp}
                onVerifyOtp={verifyGuestOtp}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
