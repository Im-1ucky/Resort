
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";
import { apiFetch } from "@/services/api";
import { formatIndianDate } from "@/utils/date";

function isValidCardNumber(value) {
  const digits = value.replace(/[\s-]/g, "");

  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let doubleDigit = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);

    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function isValidExpiry(value) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;

  const [month, year] = value.split("/").map(Number);
  const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59);

  return expiryDate >= new Date();
}

function PaymentContent() {
  const params = useSearchParams();
  const bookingId = params.get("bookingId");

  const [booking, setBooking] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });

  const [amount, setAmount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentResult, setPaymentResult] = useState(null);

  useEffect(() => {
    if (!bookingId) return;

    const stored = sessionStorage.getItem(`estate_booking_${bookingId}`);

    if (stored) {
      try {
        setBooking(JSON.parse(stored));
      } catch {
        setBooking(null);
      }
    }
  }, [bookingId]);

  function updateCard(event) {
    const { name, value } = event.target;

    setCard((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function validatePayment() {
    if (paymentMethod === "UPI") {
      if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId.trim())) {
        return "Enter a valid UPI ID, such as name@okaxis.";
      }
    }

    if (paymentMethod === "CARD") {
      if (card.cardholderName.trim().length < 2) {
        return "Enter the cardholder name.";
      }

      if (!isValidCardNumber(card.cardNumber)) {
        return "Enter a valid card number.";
      }

      if (!isValidExpiry(card.expiry)) {
        return "Enter a valid, unexpired card expiry date in MM/YY format.";
      }

      if (!/^\d{3,4}$/.test(card.cvv)) {
        return "Enter a valid CVV.";
      }
    }

    return "";
  }

  async function handlePayment(event) {
    event.preventDefault();
    setError("");

    if (!bookingId || !booking) {
      setError("Booking details could not be found. Please start your booking again.");
      return;
    }

    const validationError = validatePayment();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Create a pending payment using the selected method.
      const paymentResponse = await apiFetch(`/bookings/${bookingId}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod }),
      });

      const payment = paymentResponse.payment;

      if (!payment?.id) {
        throw new Error("Unable to create a payment attempt.");
      }

      setAmount(payment.amount);

      // Complete the development-only demo payment.
      const paymentDetails =
        paymentMethod === "UPI"
          ? {
              paymentMethod: "UPI",
              upiId: upiId.trim(),
            }
          : {
              paymentMethod: "CARD",
              cardholderName: card.cardholderName.trim(),
              cardNumber: card.cardNumber.replace(/[\s-]/g, ""),
              expiry: card.expiry,
              cvv: card.cvv,
            };

      const result = await apiFetch(
        `/payments/${payment.id}/demo-checkout`,
        {
          method: "POST",
          body: JSON.stringify(paymentDetails),
        },
      );

      setPaymentResult(result);

      sessionStorage.removeItem(`estate_booking_${bookingId}`);
      sessionStorage.removeItem(`estate_cancel_${bookingId}`);
    } catch (err) {
      setError(err.message || "Payment could not be completed.");
    } finally {
      // Clear sensitive card data from component state.
      setCard({
        cardholderName: "",
        cardNumber: "",
        expiry: "",
        cvv: "",
      });

      setLoading(false);
    }
  }

  if (!bookingId || !booking) {
    return (
      <main className="min-h-screen bg-[var(--ivory)] px-5 pt-32">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8">
          <h1 className="text-3xl text-[var(--forest)]">
            Booking details unavailable
          </h1>
          <p className="mt-3 text-gray-600">
            Please return to the booking page and try again.
          </p>
          <a
            href="/rooms"
            className="mt-6 inline-block rounded-full bg-[var(--forest)] px-6 py-3 text-white"
          >
            Browse rooms
          </a>
        </section>
      </main>
    );
  }

  if (paymentResult) {
    return (
      <main className="min-h-screen bg-[var(--ivory)] px-5 py-32">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">
            ✓
          </div>

          <h1 className="mt-6 font-[var(--font-display)] text-4xl text-[var(--forest)]">
            Booking confirmed!
          </h1>

          <p className="mt-3 text-gray-600">
            Your demo payment was successful. Your stay is confirmed.
          </p>

          <div className="mt-7 space-y-3 border-y border-gray-200 py-5 text-left">
            <p>
              <span className="text-gray-500">Booking reference:</span>{" "}
              <strong>{bookingId}</strong>
            </p>
            <p>
              <span className="text-gray-500">Payment:</span> Successful
            </p>
            <p>
              <span className="text-gray-500">Method:</span> {paymentMethod}
            </p>
            <p>
              <span className="text-gray-500">Transaction ID:</span>{" "}
              {paymentResult.payment?.transactionId || "Demo transaction"}
            </p>
            <p>
              <span className="text-gray-500">Amount:</span>{" "}
              ₹{Number(amount ?? booking.totalAmount ?? 0).toLocaleString("en-IN")}
            </p>
          </div>

          <a
            href="/"
            className="mt-7 inline-flex items-center justify-center rounded-full bg-[#382F27] px-7 py-3 text-sm font-semibold !text-white transition-colors hover:bg-[#241C17]"
          >
            Back to home
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ivory)] px-5 pb-20 pt-32">
      <section className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_0.8fr]">
        <div>
          <h1 className="mt-3 font-[var(--font-display)] text-5xl text-[var(--forest)]">
            Complete payment
          </h1>

          <form
            onSubmit={handlePayment}
            className="mt-8 space-y-6 rounded-2xl bg-white p-6 shadow-sm md:p-8"
          >
            <div>
              <h2 className="text-lg font-medium text-[var(--forest)]">
                Payment method
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("UPI")}
                  className={`rounded-xl border p-4 text-left ${
                    paymentMethod === "UPI"
                      ? "border-[var(--forest)] bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  <span className="block font-medium">UPI</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    UPI ID
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  className={`rounded-xl border p-4 text-left ${
                    paymentMethod === "CARD"
                      ? "border-[var(--forest)] bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  <span className="block font-medium">Card</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Credit or debit card
                  </span>
                </button>
              </div>
            </div>

            {paymentMethod === "UPI" ? (
              <label className="block text-sm text-gray-700">
                UPI ID
                <input
                  required
                  value={upiId}
                  onChange={(event) => setUpiId(event.target.value)}
                  placeholder="name@okaxis"
                  className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <label className="min-w-0 text-sm text-gray-700">
                  Cardholder name
                  <input
                    required
                    name="cardholderName"
                    value={card.cardholderName}
                    onChange={updateCard}
                    autoComplete="cc-name"
                    placeholder="Name on card"
                    className="mt-2 w-full min-w-0 rounded-lg border border-gray-300 p-3"
                  />
                </label>

                <label className="min-w-0 text-sm text-gray-700">
                  Card number
                  <input
                    required
                    name="cardNumber"
                    value={card.cardNumber}
                    onChange={updateCard}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    className="mt-2 w-full min-w-0 rounded-lg border border-gray-300 p-3"
                  />
                </label>

                <label className="min-w-0 text-sm text-gray-700">
                  Expiry
                  <input
                    required
                    name="expiry"
                    value={card.expiry}
                    onChange={updateCard}
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    className="mt-2 w-full min-w-0 rounded-lg border border-gray-300 p-3"
                  />
                </label>

                <label className="min-w-0 text-sm text-gray-700">
                  CVV
                  <input
                    required
                    type="password"
                    name="cvv"
                    value={card.cvv}
                    onChange={updateCard}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    placeholder="123"
                    className="mt-2 w-full min-w-0 rounded-lg border border-gray-300 p-3"
                  />
                </label>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ display: "block", visibility: "visible" }}
              className="block min-h-12 w-full rounded-full bg-[#203c30] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#162c22] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Processing payment..." : "Pay Now"}
            </button>

            <p className="text-center text-xs text-gray-500">
              Demo checkout only. No real money will be charged.
            </p>
          </form>
        </div>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-medium text-[var(--forest)]">
            Booking summary
          </h2>

          <div className="mt-6 space-y-4 text-sm">
            <div>
              <p className="text-gray-500">Guest</p>
              <p className="mt-1 font-medium">{booking.guestName}</p>
            </div>

            <div>
              <p className="text-gray-500">Email</p>
              <p className="mt-1 font-medium">{booking.guestEmail}</p>
            </div>

            <div>
              <p className="text-gray-500">Booking reference</p>
              <p className="mt-1 break-all font-medium">{booking.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">Check-in</p>
                <p className="mt-1 font-medium">{formatIndianDate(booking.checkIn)}</p>
              </div>
              <div>
                <p className="text-gray-500">Check-out</p>
                <p className="mt-1 font-medium">{formatIndianDate(booking.checkOut)}</p>
              </div>
            </div>

            <div>
              <p className="text-gray-500">Guests</p>
              <p className="mt-1 font-medium">
                {booking.adults} adults, {booking.children} children
              </p>
            </div>

            <div>
              <p className="text-gray-500">Rooms</p>
              <p className="mt-1 font-medium">{booking.quantity}</p>
            </div>
          </div>

          <div className="mt-7 border-t border-gray-200 pt-5">
            <p className="text-sm text-gray-500">Total payable</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--forest)]">
              {booking.totalAmount != null
                ? `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`
                : "Calculated at checkout"}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <main className="min-h-screen bg-[var(--ivory)] p-10">
            Loading payment...
          </main>
        }
      >
        <PaymentContent />
      </Suspense>
    </>
  );
}
