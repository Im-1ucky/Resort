import Navbar from "@/components/navbar/Navbar";
import Hero from "./sections/Hero";
import RoomShowcase from "@/screens/home/sections/RoomShowcase";
import EventsSection from "@/screens/home/sections/EventsSection";
import ActivitiesSection from "./sections/ActivitiesSection";
import FooterSection from "./sections/FooterSection";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <RoomShowcase />
        <EventsSection />
        <ActivitiesSection />
        <FooterSection />
      </main>
    </>
  );
}
