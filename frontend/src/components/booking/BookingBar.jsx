
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Search } from "lucide-react";

import DateRangePicker from "@/components/booking/DateRangePicker";
import GuestSelector from "./GuestSelector";

export default function BookingBar({ placement = "hero" }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isHeroInstance = placement === "hero";

  const hideBookingBar =
    pathname === "/booking" || pathname === "/payment";

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

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  if (hideBookingBar) return null;
  if (isHeroInstance && !isHome) return null;
  if (!isHeroInstance && isHome) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const isCompact = isMobile || (isHome ? scrolled : !expanded);
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
        isCompact ? "max-w-[450px]" : "max-w-[650px]"
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
        className="grid w-full grid-cols-[2fr_1.5fr_42px] items-center gap-0 rounded-full bg-ivory px-3 py-2 text-[#382F27] shadow-xl"
      >
        {/* Dates */}
        <motion.div
          layout
          className="h-full min-w-0 border-r border-[#D8D0C4] pl-3"
        >
          <DateRangePicker compact />
        </motion.div>

        {/* Guests */}
        <motion.div
          layout
          className="h-full min-w-0 px-3"
        >
          <GuestSelector compact />
        </motion.div>

        {/* Search */}
        <button
          type="submit"
          aria-label="Check availability"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#382F27] text-[#F5F2EA] transition-colors hover:bg-[#241C17]"
        >
          <Search size={18} strokeWidth={2} />
        </button>
      </motion.form>
    </motion.div>
  );
}
