import { Suspense } from "react";
import Navbar from "@/components/navbar/Navbar";
import BookingPage from "@/screens/booking/BookingPage";

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
