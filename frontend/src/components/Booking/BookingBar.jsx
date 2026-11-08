
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import DateRangePicker from "@/components/ui/DateRangePicker";
import GuestSelector from "./GuestSelector";

export default function BookingBar({ placement = "hero" }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isHeroInstance = placement === "hero";

  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolled(false);
      setExpanded(false);
      return;
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 120);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isHome]);

  // Show the Hero instance only on the homepage.
  if (isHeroInstance && !isHome) return null;

  // Show the global instance only on inner pages.
  if (!isHeroInstance && isHome) return null;

  const isCompact = isHome ? scrolled : !expanded;
  const isFloating = !isHeroInstance || scrolled;

  return (
    <motion.div
      layout
      transition={{
        layout: {
          type: "spring",
          stiffness: 260,
          damping: 30,
        },
      }}
      className={`mx-auto w-full ${
        isCompact ? "max-w-[480px]" : "max-w-3xl"
      } ${
        isFloating
          ? "fixed left-1/2 top-4 z-[100] -translate-x-1/2 px-4"
          : "relative"
      }`}
    >
      <motion.form
        layout
        action="/rooms"
        method="GET"
        transition={{
          layout: {
            type: "spring",
            stiffness: 260,
            damping: 30,
          },
        }}
        className={`grid text-[#382F27] shadow-xl ${
          isCompact
            ? "grid-cols-[2fr_1fr_42px] items-stretch gap-0 rounded-full bg-[#F5F2EA] px-3 py-2"
            : "grid-cols-1 gap-y-3 rounded-xl bg-[#F5F2EA] p-4 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-4 sm:px-5 sm:py-4"
        }`}
      >
        {/* Check-in and Check-out */}
        <motion.div
          layout
          className={`h-full min-w-0 ${
            isCompact ? "pl-3" : "sm:col-span-2"
          }`}
        >
          <DateRangePicker compact={isCompact} />
        </motion.div>

        {/* Guests */}
        <motion.div layout className="h-full min-w-0">
          <GuestSelector compact={isCompact} />
        </motion.div>

        {/* Search / Expand */}
        {isCompact ? (
          <button
            type={isHome ? "submit" : "button"}
            onClick={() => {
              if (!isHome) setExpanded(true);
            }}
            aria-label={
              isHome ? "Check availability" : "Expand booking bar"
            }
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#382F27] text-[#F5F2EA] transition-colors hover:bg-[#241C17]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
          </button>
        ) : (
          <motion.button
            layout
            type="submit"
            className="col-span-1 h-10 w-full rounded-full bg-[#382F27] text-[11px] font-semibold tracking-wide text-[#F5F2EA] transition-colors hover:bg-[#241C17] sm:col-span-3"
          >
            CHECK AVAILABILITY
          </motion.button>
        )}
      </motion.form>
    </motion.div>
  );
}
