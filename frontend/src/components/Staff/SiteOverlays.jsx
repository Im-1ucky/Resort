
"use client";

import { usePathname } from "next/navigation";
import BookingBar from "@/components/Booking/BookingBar";
import FloatingEnquiry from "@/components/Enquiry/FloatingEnquiry";

export default function SiteOverlays() {
  const pathname = usePathname();

  if (pathname.startsWith("/staff")) return null;

  return (
    <>
      <BookingBar placement="global" />
      <FloatingEnquiry />
    </>
  );
}
