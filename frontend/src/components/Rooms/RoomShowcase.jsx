"use client";

import { useEffect, useMemo, useState } from "react";
import { useBooking } from "@/components/Booking/BookingProvider";
import { apiFetch } from "@/lib/api";
import RoomCard from "./RoomCard";

function toDateString(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function RoomShowcase() {
  const { checkIn, checkOut, adults, childrenCount } = useBooking();

  const [rooms, setRooms] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dates = useMemo(
    () => ({
      checkIn: toDateString(checkIn),
      checkOut: toDateString(checkOut),
    }),
    [checkIn, checkOut]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRooms() {
      setLoading(true);
      setError("");

      try {
        const data = await apiFetch("/room-types/public");

        if (!cancelled) {
          setRooms(
            (data.roomTypes || []).filter((room) => room.isActive !== false)
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load accommodation.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRooms();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      if (!dates.checkIn || !dates.checkOut) {
        setAvailability([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          checkIn: dates.checkIn,
          checkOut: dates.checkOut,
          adults: String(adults),
          children: String(childrenCount),
        });

        const data = await apiFetch(`/availability?${params.toString()}`);

        if (!cancelled) {
          setAvailability(data.roomTypes || []);
        }
      } catch {
        if (!cancelled) setAvailability([]);
      }
    }

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [dates, adults, childrenCount]);

  function getPrice(roomId) {
    const result = availability.find((item) => item.id === roomId);
    const pricing = result?.pricing;

    if (!pricing || !pricing.nights) return null;

    return Number(pricing.totalWithTax) / Number(pricing.nights);
  }

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const priceA = getPrice(a.id) ?? Infinity;
      const priceB = getPrice(b.id) ?? Infinity;

      return priceA - priceB;
    });
  }, [rooms, availability]);

  function bookRoom(room) {
    const params = new URLSearchParams({
      roomTypeId: room.id,
      quantity: "1",
    });

    if (dates.checkIn) params.set("checkIn", dates.checkIn);
    if (dates.checkOut) params.set("checkOut", dates.checkOut);

    params.set("adults", String(adults));
    params.set("children", String(childrenCount));

    window.location.href = `/booking?${params.toString()}`;
  }

  return (
    <section className="overflow-hidden bg-[#f5f2eb] pt-2 pb-16 sm:pt-8 sm:pb-20">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 px-6 sm:px-12 lg:px-0">
          <p className="text-[13px] font-semibold tracking-[0.22em] text-[#9a7658]">
            STAY WITH US
          </p>

          <h2 className="mt-3 whitespace-nowrap font-display text-3xl leading-tight text-[#263b30] sm:text-4xl lg:text-5xl">
            Find your place{" "}
            <span className="italic">in the hills.</span>
          </h2>
        </div>

        {loading && (
          <p className="px-6 py-16 text-center text-sm text-[#71695f]">
            Discovering our rooms...
          </p>
        )}

        {error && (
          <p className="px-6 py-12 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && !error && rooms.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-[#71695f]">
            No accommodation is currently available.
          </p>
        )}

        {!loading && rooms.length > 0 && (
          <div
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6 sm:gap-6 sm:px-12 lg:px-20"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {sortedRooms.map((room) => (
              <div key={room.id} className="snap-start">
                <RoomCard
                  room={room}
                  price={getPrice(room.id)}
                  onSelect={setSelectedRoom}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRoom && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setSelectedRoom(null)}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-dialog-title"
            className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto bg-[#f5f2eb] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedRoom(null)}
              aria-label="Close room details"
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-[#382f27] shadow"
            >
              ×
            </button>

            <div className="grid md:grid-cols-2">
              <div className="min-h-[300px] bg-[#e7e2d8] md:min-h-[580px]">
                <img
                  src={
                    selectedRoom.images?.[0]?.url ||
                    selectedRoom.images?.[0] ||
                    "/images/hero/resort-hero.jpg"
                  }
                  alt={selectedRoom.name}
                  className="h-full min-h-[300px] w-full object-cover md:min-h-[580px]"
                />
              </div>

              <div className="flex flex-col justify-center p-7 sm:p-10">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#9a7658]">
                  THE ESTATE · ACCOMMODATION
                </p>

                <h2
                  id="room-dialog-title"
                  className="mt-4 font-display text-4xl leading-tight text-[#263b30] sm:text-5xl"
                >
                  {selectedRoom.name}
                </h2>

                <p className="mt-5 text-sm leading-7 text-[#71695f]">
                  {selectedRoom.description ||
                    selectedRoom.shortDescription ||
                    "Experience a peaceful stay in the heart of the coffee estate."}
                </p>

                <div className="mt-7 grid grid-cols-2 gap-4 border-y border-[#263b30]/15 py-6">
                  <div>
                    <p className="text-[10px] tracking-widest text-[#968d80]">
                      MAXIMUM GUESTS
                    </p>
                    <p className="mt-2 text-sm text-[#263b30]">
                      Up to {selectedRoom.maxGuests} guests
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] tracking-widest text-[#968d80]">
                      ROOM AREA
                    </p>
                    <p className="mt-2 text-sm text-[#263b30]">
                      {selectedRoom.area
                        ? `${selectedRoom.area} sq. ft.`
                        : "Not specified"}
                    </p>
                  </div>
                </div>

                {selectedRoom.amenities?.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] tracking-widest text-[#968d80]">
                      AMENITIES
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRoom.amenities.map((amenity, index) => (
                        <span
                          key={`${amenity}-${index}`}
                          className="border border-[#263b30]/15 px-3 py-2 text-xs text-[#263b30]"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => bookRoom(selectedRoom)}
                  className="mt-9 w-full bg-[#263b30] px-6 py-4 text-sm font-medium tracking-wide text-white transition hover:bg-[#405a47]"
                >
                  CHECK AVAILABILITY & BOOK
                </button>

                <p className="mt-3 text-center text-xs text-[#968d80]">
                  Select your dates and complete your reservation.
                </p>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
