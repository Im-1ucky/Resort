"use client";

import { usePathname } from "next/navigation";
import BookingBar from "@/components/booking/BookingBar";
import FloatingEnquiry from "@/components/enquiry/FloatingEnquiry";

export default function SiteOverlays() {
  const pathname = usePathname();

  if (
    pathname === "/staff/login" ||
    pathname === "/complete-profile" ||
    pathname === "/my-bookings" ||
    pathname === "/booking" ||
    pathname === "/payment" ||
    pathname.startsWith("/payment/")
  ) {
    return null;
  }

  if (pathname.startsWith("/staff")) return null;

  return (
    <>
      <BookingBar placement="global" />
      <FloatingEnquiry />
    </>
  );
}
