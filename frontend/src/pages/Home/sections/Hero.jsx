"use client";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { useState } from "react";
import Image from "next/image";

export default function Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const guests = adults + children;

  return (
    <section className="relative isolate min-h-[720px] overflow-hidden bg-forest-dark text-ivory md:min-h-[760px]">

      {/* Hero photograph */}
      <div className="absolute inset-0 -z-20">
        <Image
          src="/images/hero/resort-hero.jpg"
          alt="The Estate resort surrounded by the Western Ghats"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Image overlays */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17251d]/80 via-[#17251d]/45 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#17251d]/65 via-transparent to-[#17251d]/10" />

      {/* Main content */}
      <div className="mx-auto flex min-h-[720px] max-w-[1600px] flex-col justify-center px-6 pb-48 pt-24 sm:px-10 md:min-h-[760px] md:px-14 md:pb-44 lg:px-20 xl:px-24">

        <div className="max-w-3xl">
          <h1 className="font-display text-6xl leading-[0.98] tracking-tight sm:text-7xl md:text-8xl lg:text-[108px]">
            Stay close
            <br />
            <span className="italic text-[#D0B28B]">
              to nature.
            </span>
          </h1>

          <p className="mt-7 max-w-lg text-sm leading-7 text-white/90 sm:text-base">
            A private escape among the coffee covered hills.
            Discover thoughtful stay, quiet mornings and
            unforgettable moments in the Western Ghats.
          </p>
        </div>
      </div>

      {/* Booking panel */}
      <div className="absolute bottom-0 left-0 z-10 w-full px-4 pb-6 sm:px-8 md:pb-10">
        <form
          action="/rooms"
          method="GET"
          className="mx-auto grid max-w-6xl grid-cols-1 gap-4 rounded-2xl bg-[#F8F6F0] p-5 text-forest shadow-2xl sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.85fr_auto] lg:items-end lg:gap-5 lg:rounded-xl lg:p-5"
        >
          {/* Date range picker */}
          <div className="min-w-0 lg:col-span-2">
            <DateRangePicker />
          </div>

          {/* Guest selector */}
          <div className="relative">
            <span className="mb-2 block text-xs font-medium text-[#665849]">
              Guests
            </span>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="flex w-full items-center justify-between border-b border-forest/20 bg-transparent py-2.5 text-left text-sm text-forest"
            >
              <span>
                {adults} Adults{children > 0 ? `, ${children} Children` : ""}
              </span>
              <span className="text-xs">⌄</span>
            </button>

            {menuOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-3 w-full min-w-[250px] rounded-xl border border-forest/10 bg-[#F8F6F0] p-5 shadow-2xl sm:bottom-auto sm:top-full sm:mb-0 sm:mt-3">

                {/* Adults */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Adults</p>
                    <p className="text-xs text-forest/55">Ages 13 or above</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Remove adult"
                      disabled={adults <= 1}
                      onClick={() => setAdults((n) => Math.max(1, n - 1))}
                      className="h-8 w-8 rounded-full border border-forest/20 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm">{adults}</span>
                    <button
                      type="button"
                      aria-label="Add adult"
                      disabled={guests >= 6}
                      onClick={() => setAdults((n) => n + 1)}
                      className="h-8 w-8 rounded-full border border-forest/20 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="border-t border-forest/10" />

                {/* Children */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Children</p>
                    <p className="text-xs text-forest/55">Ages 0–12</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Remove child"
                      disabled={children <= 0}
                      onClick={() => setChildren((n) => Math.max(0, n - 1))}
                      className="h-8 w-8 rounded-full border border-forest/20 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm">{children}</span>
                    <button
                      type="button"
                      aria-label="Add child"
                      disabled={guests >= 6}
                      onClick={() => setChildren((n) => n + 1)}
                      className="h-8 w-8 rounded-full border border-forest/20 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="mt-3 w-full rounded-full bg-coffee py-3 text-xs tracking-wider text-[#F4F1EA] hover:bg-coffee-dark"
                >
                  DONE
                </button>
              </div>
            )}

            <input type="hidden" name="adults" value={adults} />
            <input type="hidden" name="children" value={children} />
            <input type="hidden" name="guests" value={guests} />
          </div>

          {/* Availability */}
          <button
            type="submit"
            className="min-h-12 rounded-full bg-coffee px-8 py-4 text-[10px] font-medium tracking-[0.14em] text-[#F4F1EA] transition-colors duration-300 hover:bg-coffee-dark"
          >
            CHECK AVAILABILITY
          </button>
        </form>
      </div>
    </section>
  );
}
