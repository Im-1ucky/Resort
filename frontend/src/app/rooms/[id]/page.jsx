import { Suspense } from "react";
import Navbar from "@/components/Navbar/Navbar";
import RoomDetails from "@/pages/Rooms/RoomDetails";

export default function RoomDetailsPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="p-10">Loading room...</div>}>
        <RoomDetails />
      </Suspense>
    </>
  );
}
