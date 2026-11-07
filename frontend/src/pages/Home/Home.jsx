
import Navbar from "@/components/Navbar/Navbar";
import Hero from "./sections/Hero";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        <section className="min-h-screen bg-ivory px-6 py-24 sm:px-12 lg:px-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-wood">
              THE ESTATE EXPERIENCE
            </p>

            <h2 className="mt-4 max-w-2xl font-display text-5xl leading-tight text-forest sm:text-6xl">
              A slower way to experience the hills.
            </h2>

            <p className="mt-6 max-w-xl text-sm leading-7 text-coffee/70">
              Discover the quiet charm of coffee estates, thoughtful
              hospitality and the beauty of the Western Ghats.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
