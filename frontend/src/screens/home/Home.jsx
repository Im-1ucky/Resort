
import Navbar from "@/components/navbar/Navbar";
import Hero from "./sections/Hero";
import RoomShowcase from "@/components/rooms/RoomShowcase";

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
