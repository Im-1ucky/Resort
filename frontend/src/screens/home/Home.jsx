import Navbar from "@/components/navbar/Navbar";
import Hero from "./sections/Hero";
import RoomShowcase from "@/screens/home/sections/RoomShowcase";
import EventsSection from "@/screens/home/sections/EventsSection";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <RoomShowcase />
        <EventsSection />
      </main>
    </>
  );
}
