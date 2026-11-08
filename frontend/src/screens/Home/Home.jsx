
import Navbar from "@/components/Navbar/Navbar";
import Hero from "./sections/Hero";
import RoomShowcase from "@/components/Rooms/RoomShowcase";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <RoomShowcase />
      </main>
    </>
  );
}
