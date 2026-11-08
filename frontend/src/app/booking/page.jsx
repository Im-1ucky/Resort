import { Suspense } from "react";
import Navbar from "@/components/Navbar/Navbar";
import BookingPage from "@/screens/Booking/BookingPage";

export default function BookingRoute() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="p-10">Loading booking...</div>}>
        <BookingPage />
      </Suspense>
    </>
  );
}
