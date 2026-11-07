"use client";

import { motion } from "motion/react";
import DateRangePicker from "@/components/ui/DateRangePicker";
import GuestSelector from "./GuestSelector";

export default function BookingBar() {
  return (
    <motion.div
      layout
      className="mx-auto w-full max-w-3xl"
    >
      <motion.form
        layout
        action="/rooms"
        method="GET"

        className="grid grid-cols-1 gap-y-3 rounded-xl bg-[#F5F2EA] p-4 text-[#382F27] shadow-xl sm:grid-cols-3 sm:gap-x-4 sm:gap-y-4 sm:px-5 sm:py-4"
      >
        {/* Check-in and Check-out */}
        <div className="min-w-0 sm:col-span-2">
          <DateRangePicker />
        </div>

        {/* Guests */}
        <div className="min-w-0">
          <GuestSelector />
        </div>

        {/* Availability button */}
        <button
          type="submit"
          className="col-span-1 h-10 w-full rounded-full bg-[#382F27] text-[11px] font-semibold tracking-wide text-[#F5F2EA] transition-colors hover:bg-[#241C17] sm:col-span-3"
        >
          CHECK AVAILABILITY
        </button>
      </motion.form>
    </motion.div>
  );
}
