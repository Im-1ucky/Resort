import BookingBar from "@/components/Booking/BookingBar";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative isolate min-h-[900px] overflow-visible bg-forest-dark text-ivory sm:min-h-[800px] lg:min-h-[760px]">
      {/* Resort photograph */}
      <div className="absolute inset-0 -z-20">
        <Image
          src="/images/hero/resort-hero.jpg"
          alt="Resort surrounded by the coffee estates of the Western Ghats"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[78%_center] sm:object-[65%_center]"
        />
      </div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17251d]/85 via-[#17251d]/50 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#17251d]/75 via-transparent to-[#17251d]/10" />

      {/* Hero copy */}
      <div className="mx-auto flex min-h-[900px] max-w-[1600px] items-start px-6 pb-[390px] pt-28 sm:min-h-[800px] sm:px-10 sm:pb-64 sm:pt-32 md:px-14 md:pt-36 lg:min-h-[760px] lg:items-center lg:px-20 lg:pb-40 lg:pt-0 xl:px-24">
        <div className="max-w-3xl">
          <h1 className="font-display text-6xl leading-[0.96] tracking-tight sm:text-7xl md:text-8xl lg:text-[100px] xl:text-[108px]">
            Stay close
            <br />
            <span className="italic text-[#D0B28B]">
              to nature.
            </span>
          </h1>

          <p className="mt-7 max-w-lg text-sm leading-7 text-white/90 sm:text-base">
            A private escape among the coffee-covered hills.
            Discover thoughtful stays, quiet mornings and
            unforgettable moments in the Western Ghats.
          </p>
        </div>
      </div>

      {/* Booking bar */}
      <div className="absolute bottom-0 left-0 z-30 w-full px-4 pb-5 sm:px-8 sm:pb-8 lg:pb-10">
        <BookingBar placement="hero" />
      </div>
    </section>
  );
}
