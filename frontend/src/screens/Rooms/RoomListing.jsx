"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useBooking } from "@/components/Booking/BookingProvider";

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function RoomImage({ images, name }) {
  const [imageIndex, setImageIndex] = useState(0);
  const image = images?.[imageIndex];

  if (!image) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center bg-[#e5e0d5]">
        <span className="font-display text-3xl text-forest/50">
          THE ESTATE
        </span>
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={name}
      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
      onError={() => {
        if (imageIndex < images.length - 1) {
          setImageIndex((current) => current + 1);
        }
      }}
    />
  );
}

export default function RoomListing() {
  const searchParams = useSearchParams();
  const {
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    adults,
    childrenCount,
  } = useBooking();

  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryCheckIn = searchParams.get("checkIn");
    const queryCheckOut = searchParams.get("checkOut");
    const queryAdults = Number(searchParams.get("adults")) || 2;
    const queryChildren = Number(searchParams.get("children")) || 0;

    if (queryCheckIn) setCheckIn(parseISO(queryCheckIn));
    if (queryCheckOut) setCheckOut(parseISO(queryCheckOut));

    async function loadAvailability() {
      setLoading(true);
      setError("");

      try {
        const start = queryCheckIn || format(addDays(new Date(), 1), "yyyy-MM-dd");
        const end = queryCheckOut || format(addDays(new Date(), 2), "yyyy-MM-dd");

        const params = new URLSearchParams({
          checkIn: start,
          checkOut: end,
          adults: String(queryAdults),
          children: String(queryChildren),
        });

        const data = await apiFetch(`/availability?${params}`);

        setRoomTypes(data.roomTypes || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();
  }, [searchParams, setCheckIn, setCheckOut]);

  const start = checkIn || addDays(new Date(), 1);
  const end = checkOut || addDays(start, 1);

  const nights = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000)
  );

  return (
    <main className="min-h-screen bg-ivory">
      <section className="relative overflow-hidden bg-forest px-6 pb-20 pt-36 text-ivory sm:px-12 lg:px-24">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-12 -top-12 h-72 w-72 rounded-full border border-white/10" />

        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-[#D0B28B]">
            YOUR STAY AT THE ESTATE
          </p>

          <h1 className="mt-5 max-w-3xl font-display text-6xl leading-[0.95] sm:text-7xl lg:text-8xl">
            Find your
            <br />
            <span className="italic text-[#D0B28B]">place to unwind.</span>
          </h1>

          <p className="mt-7 max-w-xl text-sm leading-7 text-white/70">
            Thoughtfully designed spaces, surrounded by the quiet beauty
            of Chikkamagaluru&apos;s coffee country.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-12 lg:px-24">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-5 border-b border-forest/15 pb-7">
          <div>
            <p className="text-xs tracking-[0.2em] text-wood">
              ACCOMMODATION
            </p>
            <h2 className="mt-2 font-display text-4xl text-forest sm:text-5xl">
              Rooms & stays
            </h2>
          </div>

          <div className="text-sm text-coffee/65">
            <p>
              {format(start, "dd MMM yyyy")} — {format(end, "dd MMM yyyy")}
            </p>
            <p className="mt-1">
              {nights} {nights === 1 ? "night" : "nights"} ·{" "}
              {adults + childrenCount} guests
            </p>
          </div>
        </div>

        {loading && (
          <div className="grid gap-8 md:grid-cols-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-[440px] animate-pulse bg-cream"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-900/15 bg-red-50 p-8">
            <p className="font-medium text-red-900">
              We couldn&apos;t load room availability.
            </p>
            <p className="mt-2 text-sm text-red-800/70">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 text-sm font-semibold text-red-900 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && roomTypes.length === 0 && (
          <div className="py-20 text-center">
            <h3 className="font-display text-4xl text-forest">
              No rooms available
            </h3>
            <p className="mt-3 text-sm text-coffee/60">
              Try different dates or adjust the number of guests.
            </p>
          </div>
        )}

        {!loading && !error && roomTypes.length > 0 && (
          <div className="grid gap-10 md:grid-cols-2">
            {roomTypes.map((room) => (
              <article
                key={room.id}
                className="group overflow-hidden bg-white shadow-sm transition duration-500 hover:-translate-y-1 hover:shadow-xl"
              >
                <Link
                  href={`/rooms/${room.id}`}
                  className="block"
                >
                  <div className="relative h-[300px] overflow-hidden bg-cream">
                    <RoomImage images={room.images} name={room.name} />

                    <span className="absolute left-5 top-5 bg-ivory/95 px-4 py-2 text-[10px] font-semibold tracking-[0.15em] text-forest">
                      {room.availableUnits > 0
                        ? `${room.availableUnits} AVAILABLE`
                        : "UNAVAILABLE"}
                    </span>
                  </div>

                  <div className="p-7 sm:p-9">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold tracking-[0.2em] text-wood">
                          THE ESTATE COLLECTION
                        </p>
                        <h3 className="mt-3 font-display text-4xl text-forest">
                          {room.name}
                        </h3>
                      </div>

                      <span className="mt-1 text-2xl text-wood transition-transform duration-300 group-hover:translate-x-2">
                        →
                      </span>
                    </div>

                    {room.shortDescription && (
                      <p className="mt-4 text-sm leading-7 text-coffee/65">
                        {room.shortDescription}
                      </p>
                    )}

                    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-forest/10 pb-6 text-xs text-coffee/65">
                      {room.area && <span>{room.area} sq. ft.</span>}
                      {room.bedConfiguration && (
                        <span>{room.bedConfiguration}</span>
                      )}
                      <span>Up to {room.maxGuests} guests</span>
                    </div>

                    <div className="flex items-end justify-between gap-4 pt-6">
                      <div>
                        {room.pricing ? (
                          <>
                            <p className="text-xs text-coffee/50">
                              Total for {room.pricing.nights} nights
                            </p>
                            <p className="mt-1 font-display text-3xl text-forest">
                              {formatPrice(room.pricing.totalWithTax)}
                            </p>
                            <p className="mt-1 text-[10px] text-coffee/50">
                              Includes taxes
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-coffee/60">
                            Price unavailable for these dates
                          </p>
                        )}
                      </div>

                      <span className="border-b border-forest pb-2 text-[10px] font-semibold tracking-[0.15em] text-forest">
                        EXPLORE
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
