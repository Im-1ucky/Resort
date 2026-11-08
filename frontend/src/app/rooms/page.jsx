import { Suspense } from "react";
import Navbar from "@/components/Navbar/Navbar";
import RoomListing from "@/pages/Rooms/RoomListing";

export default function RoomsPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="p-10">Loading rooms...</div>}>
        <RoomListing />
      </Suspense>
    </>
  );
}
