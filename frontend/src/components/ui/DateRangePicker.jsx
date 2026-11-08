
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { format, startOfDay, isSameDay } from "date-fns";
import { useBooking } from "@/components/Booking/BookingProvider";

export default function DateRangePicker({
  checkInName = "checkIn",
  checkOutName = "checkOut",
  compact = false,
}) {
  const {
    checkIn: startDate,
    checkOut: endDate,
    setCheckIn: setStartDate,
    setCheckOut: setEndDate,
  } = useBooking();

  const [month, setMonth] = useState(new Date());
  const [numberOfMonths, setNumberOfMonths] = useState(1);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const today = startOfDay(new Date());

  useEffect(() => {
    setMounted(true);

    const mediaQuery = window.matchMedia("(min-width: 640px)");

    const updateMonths = () => {
      setNumberOfMonths(mediaQuery.matches ? 2 : 1);
    };

    updateMonths();
    mediaQuery.addEventListener("change", updateMonths);

    return () => {
      mediaQuery.removeEventListener("change", updateMonths);
    };
  }, []);

  // Position calendar above or below the booking bar.
  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      const popup = popupRef.current;

      if (!trigger || !popup) return;

      const rect = trigger.getBoundingClientRect();
      const popupHeight = popup.offsetHeight;
      const popupWidth = popup.offsetWidth;
      const margin = 12;

      const spaceBelow = window.innerHeight - rect.bottom;
      const openAbove =
        spaceBelow < popupHeight + margin &&
        rect.top > popupHeight + margin;

      const top = openAbove
        ? rect.top - popupHeight - margin
        : rect.bottom + margin;

      const left = Math.max(
        16,
        Math.min(
          rect.left + rect.width / 2 - popupWidth / 2,
          window.innerWidth - popupWidth - 16
        )
      );

      setPosition({ top, left });
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, numberOfMonths]);

  // Close on outside click or Escape.
  useEffect(() => {
    function handleOutsideClick(event) {
      const insideTrigger = pickerRef.current?.contains(event.target);
      const insidePopup = popupRef.current?.contains(event.target);

      if (!insideTrigger && !insidePopup) {
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

  function handleDateSelect(range) {
    const from = range?.from ?? null;
    const to = range?.to ?? null;

    setStartDate(from);
    setEndDate(from && to && isSameDay(from, to) ? null : to);
  }

  const dateLabel = (date) =>
    date
      ? format(date, compact ? "MMM d" : "dd/MM/yyyy")
      : compact
        ? "Add date"
        : "Select date";

  return (
    <div ref={pickerRef} className="relative h-full w-full">
      {/* Check-in and check-out fields */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Choose check-in and check-out dates"
        className={`grid h-full w-full items-center text-left ${
          compact
            ? "grid-cols-2 gap-0"
            : "grid-cols-[1fr_auto_1fr_auto] gap-3"
        }`}
      >
        <div
          className={`flex min-h-[48px] min-w-0 flex-col justify-center ${
            compact ? "border-r border-forest/20 pr-3" : ""
          }`}
        >
          <span className="mb-1 block text-[10px] font-semibold tracking-[0.12em] text-wood">
            CHECK IN
          </span>

          <span
            className={`block truncate py-1 text-sm font-medium ${
              startDate ? "text-forest" : "text-forest/45"
            } ${compact ? "" : "border-b border-forest/20"}`}
          >
            {dateLabel(startDate)}
          </span>
        </div>

        {compact ? (
          <div className="flex min-h-[48px] min-w-0 flex-col justify-center pl-3">
            <span className="mb-1 block text-[10px] font-semibold tracking-[0.12em] text-wood">
              CHECK OUT
            </span>

            <span
              className={`block truncate py-1 text-sm font-medium ${
                endDate ? "text-forest" : "text-forest/45"
              }`}
            >
              {dateLabel(endDate)}
            </span>
          </div>
        ) : (
          <>
            <span className="mt-5 text-wood">→</span>

            <div className="flex min-h-[48px] min-w-0 flex-col justify-center">
              <span className="mb-1 block text-[10px] font-semibold tracking-[0.12em] text-wood">
                CHECK OUT
              </span>

              <span
                className={`block truncate border-b border-forest/20 py-1 text-sm font-medium ${
                  endDate ? "text-forest" : "text-forest/45"
                }`}
              >
                {dateLabel(endDate)}
              </span>
            </div>
          </>
        )}
      </button>

      {/* Calendar popup */}
      {open &&
        mounted &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              zIndex: 9999,
              visibility: position.top ? "visible" : "hidden",
            }}
            className="relative w-[min(340px,calc(100vw-32px))] rounded-xl border border-forest/10 bg-[#f7f4ed] p-5 text-forest shadow-2xl sm:w-[min(680px,calc(100vw-32px))] sm:p-6"
          >
            <DayPicker
              mode="range"
              min={1}
              month={month}
              onMonthChange={setMonth}
              selected={{
                from: startDate ?? undefined,
                to: endDate ?? undefined,
              }}
              onSelect={handleDateSelect}
              numberOfMonths={numberOfMonths}
              pagedNavigation={numberOfMonths > 1}
              disabled={{ before: today }}
              showOutsideDays={false}
              modifiers={{
                singleCheckIn:
                  startDate && !endDate ? startDate : undefined,
              }}
              modifiersClassNames={{
                range_start: "booking-range-start",
                range_end: "booking-range-end",
                range_middle: "booking-range-middle",
                singleCheckIn: "booking-single-check-in",
              }}
              classNames={{
                root: `booking-calendar relative w-full ${
                  startDate && !endDate ? "booking-calendar--selecting-end" : ""
                }`,
                months: "flex flex-col gap-6 sm:flex-row sm:gap-8",
                month: "w-full flex-1",
                month_caption:
                  "relative mb-3 flex h-9 items-center justify-center",
                caption_label: "font-semibold text-sm text-forest",
                nav:
                  "absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-1",
                button_previous:
                  "flex h-9 w-9 items-center justify-center rounded-full text-forest transition hover:bg-forest/10",
                button_next:
                  "flex h-9 w-9 items-center justify-center rounded-full text-forest transition hover:bg-forest/10",
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday:
                  "flex-1 py-2 text-center text-[10px] font-medium uppercase text-wood",
                week: "mt-1 flex w-full",
                day: "flex-1 text-center",
                day_button:
                  "mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm text-forest transition hover:bg-forest/10 focus-visible:outline-2 focus-visible:outline-wood",
                today:
                  "font-bold underline decoration-wood underline-offset-4",
                disabled: "cursor-not-allowed !text-forest/20",
                outside: "invisible",
                hidden: "invisible",
              }}
            />

            {/* Checkout reminder */}
            <div className="mt-5 border-t border-forest/10 pt-4">
              <p className="text-center text-xs text-forest/60">
                {startDate && endDate
                  ? `Please check out by the morning of ${format(
                      endDate,
                      "dd MMMM yyyy"
                    )}.`
                  : startDate
                    ? "Now select your departure date."
                    : "Select your check-in and check-out dates."}
              </p>
            </div>
          </div>,
          document.body
        )}

      {/* Values submitted to the backend */}
      <input
        type="hidden"
        name={checkInName}
        value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
      />

      <input
        type="hidden"
        name={checkOutName}
        value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
      />
    </div>
  );
}
