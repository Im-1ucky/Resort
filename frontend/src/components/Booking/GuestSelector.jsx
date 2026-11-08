"use client";

import { useState, useEffect, useRef } from "react";
import { useBooking } from "./BookingProvider";

export default function GuestSelector({ compact = false }) {
  const {
    adults,
    setAdults,
    childrenCount,
    setChildrenCount,
  } = useBooking();

  const [open, setOpen] = useState(false);
  const selectorRef = useRef(null);

  const guests = adults + childrenCount;

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!selectorRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function updateAdults(change) {
    const next = adults + change;

    if (next >= 1 && next + childrenCount <= 6) {
      setAdults(next);
    }
  }

  function updateChildren(change) {
    const next = childrenCount + change;

    if (next >= 0 && adults + next <= 6) {
      setChildrenCount(next);
    }
  }

  return (
    <div
      ref={selectorRef}
      className={`relative h-full min-w-0 ${
        compact ? "border-l border-forest/20 pl-3" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-full min-h-[48px] w-full flex-col justify-center text-left"
      >
        <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-wood">
          GUESTS
        </p>

        <p
          className={`block truncate py-1 text-sm font-medium text-forest ${
            compact ? "" : "border-b border-forest/20"
          }`}
        >
          {guests} {guests === 1 ? "Guest" : "Guests"}
        </p>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-64 rounded-xl border border-forest/10 bg-[#F5F2EA] p-4 text-forest shadow-xl">
          {[
            {
              label: "Adults",
              description: "Ages 13 or above",
              value: adults,
              update: updateAdults,
              min: 1,
            },
            {
              label: "Children",
              description: "Ages 0–12",
              value: childrenCount,
              update: updateChildren,
              min: 0,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-forest/55">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => item.update(-1)}
                  disabled={item.value <= item.min}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-forest/25 disabled:opacity-30"
                  aria-label={`Remove ${item.label}`}
                >
                  −
                </button>

                <span className="w-4 text-center text-sm">
                  {item.value}
                </span>

                <button
                  type="button"
                  onClick={() => item.update(1)}
                  disabled={guests >= 6}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-forest/25 disabled:opacity-30"
                  aria-label={`Add ${item.label}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="children" value={childrenCount} />
      <input type="hidden" name="guests" value={guests} />
    </div>
  );
}
