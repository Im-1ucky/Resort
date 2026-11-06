
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { format, startOfDay, isSameDay } from "date-fns";

export default function DateRangePicker({
  checkInName = "checkIn",
  checkOutName = "checkOut",
}) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [month, setMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const today = startOfDay(new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

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
          rect.left,
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
  }, [open]);

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

  function handleDateSelect(date) {
    if (!date) return;

    if (!startDate || endDate) {
      setStartDate(date);
      setEndDate(null);
      return;
    }

    if (isSameDay(date, startDate)) return;

    if (date < startDate) {
      setStartDate(date);
      setEndDate(startDate);
    } else {
      setEndDate(date);
    }
  }

  const dateLabel = (date) =>
    date ? format(date, "dd/MM/yyyy") : "Select date";

  return (
    <div ref={pickerRef} className="relative w-full">
      {/* Booking date display */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Choose check-in and check-out dates"
        className="grid w-full grid-cols-[1fr_auto_1fr_auto] items-center gap-3 text-left"
      >
        <div className="min-w-0">
          <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-wood">
            CHECK IN
          </span>
          <span className={`block truncate border-b py-2 text-sm ${
            startDate
              ? "border-forest/20 text-forest"
              : "border-forest/20 text-forest/45"
          }`}>
            {dateLabel(startDate)}
          </span>
        </div>

        <span className="mt-6 text-wood">→</span>

        <div className="min-w-0">
          <span className="mb-2 block text-[10px] font-medium tracking-[0.12em] text-wood">
            CHECK OUT
          </span>
          <span className={`block truncate border-b py-2 text-sm ${
            endDate
              ? "border-forest/20 text-forest"
              : "border-forest/20 text-forest/45"
          }`}>
            {dateLabel(endDate)}
          </span>
        </div>

        <span className="mt-6 text-forest/60">▦</span>
      </button>

      {/* Calendar rendered outside the Hero section */}
      {open && mounted &&
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
            className="w-[min(340px,calc(100vw-32px))] rounded-xl border border-forest/10 bg-[#f7f4ed] p-4 text-forest shadow-2xl sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-lg text-forest">
                  Choose your stay
                </p>
                <p className="mt-1 text-xs text-forest/60">
                  Select any two dates
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStartDate(null);
                  setEndDate(null);
                }}
                className="text-xs text-wood transition hover:text-forest"
              >
                Clear
              </button>
            </div>

            <DayPicker
              mode="single"
              month={month}
              onMonthChange={setMonth}
              onSelect={handleDateSelect}
              disabled={{ before: today }}
              showOutsideDays={false}
              modifiers={{
                range_start: startDate,
                range_end: endDate,
                range_middle:
                  startDate && endDate
                    ? { from: startDate, to: endDate }
                    : undefined,
              }}
              modifiersClassNames={{
                range_start:
                  "!rounded-l-full !rounded-r-none !bg-forest !text-white",
                range_end:
                  "!rounded-r-full !rounded-l-none !bg-forest !text-white",
                range_middle:
                  "!rounded-none !bg-forest/10 !text-forest",
              }}
              classNames={{
                root: "w-full",
                months: "w-full",
                month: "w-full",

                month_caption:
                  "relative mb-2 flex h-7 items-center justify-center",

                caption_label:
                  "font-medium text-sm text-forest",

                nav:
                  "absolute inset-x-0 top-0 flex items-center justify-between",

                button_previous:
                  "flex h-7 w-7 items-center justify-center rounded-full text-forest hover:bg-forest/10",

                button_next:
                  "flex h-7 w-7 items-center justify-center rounded-full text-forest hover:bg-forest/10",

                month_grid:
                  "w-full border-collapse",

                weekdays:
                  "flex",

                weekday:
                  "flex-1 py-1.5 text-center text-[9px] font-medium uppercase text-wood",

                week:
                  "mt-0.5 flex w-full",

                day:
                  "flex-1 text-center",

                day_button:
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs text-forest transition hover:bg-forest/10 focus-visible:outline-2 focus-visible:outline-wood",

                today:
                  "font-bold underline decoration-wood underline-offset-4",

                disabled:
                  "cursor-not-allowed !text-forest/20",

                outside:
                  "invisible",

                hidden:
                  "invisible",
              }}
            />

            <div className="mt-4 border-t border-forest/10 pt-3">
              <p className="text-center text-[11px] text-forest/60">
                {startDate && endDate
                  ? `${Math.round(
                      (endDate - startDate) / (1000 * 60 * 60 * 24)
                    )} nights selected`
                  : startDate
                    ? "Now select your other date"
                    : "Choose your arrival and departure dates"}
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
