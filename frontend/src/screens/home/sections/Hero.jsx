import Image from "next/image";
import BookingBar from "@/components/booking/BookingBar";

export default function Hero() {
  return (
    <>
      <section className="relative isolate mt-[60px] flex min-h-[200px] w-full items-center overflow-hidden bg-forest-dark text-ivory sm:mt-[72px] sm:min-h-[230px] lg:min-h-[260px]">

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
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#17251d]/40 to-transparent" />

        {/* Hero copy */}
        <div className="mx-auto flex min-h-[200px] w-full max-w-[1600px] items-center px-6 sm:min-h-[230px] sm:px-10 md:px-14 lg:min-h-[260px] lg:px-20 xl:px-24">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Stay close
              <br />
              <span className="italic text-olive">
                to nature.
              </span>
            </h1>
          </div>
        </div>
      </section>

      {/* Booking bar below hero */}
      <section className="relative z-30 min-h-[90px] w-full px-4 pt-8 pb-0 sm:min-h-[104px] sm:px-8 sm:pt-10">
        <BookingBar placement="hero" />
      </section>
    </>
  );
}
