
"use client";

import { useEffect, useMemo, useState } from "react";
import { useBooking } from "@/contexts/BookingProvider";
import { apiFetch } from "@/services/api";
import RoomCard from "./RoomCard";
import ExpandedRoomCard from "@/components/rooms/ExpandedRoomCard";

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

  // Load room types
  useEffect(() => {
    let cancelled = false;

    async function loadRooms() {
      setLoading(true);
      setError("");

      try {
        const data = await apiFetch("/room-types/public");

        if (!cancelled) {
          setRooms(
            (data.roomTypes || []).filter(
              (room) => room.isActive !== false
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load accommodation.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRooms();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load availability
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

        const data = await apiFetch(
          `/availability?${params.toString()}`
        );

        if (!cancelled) {
          setAvailability(data.roomTypes || []);
        }
      } catch {
        if (!cancelled) {
          setAvailability([]);
        }
      }
    }

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [dates, adults, childrenCount]);

  // Get nightly price
  function getPrice(roomId) {
    const result = availability.find(
      (item) => item.id === roomId
    );

    const pricing = result?.pricing;

    if (!pricing || !pricing.nights) return null;

    return (
      Number(pricing.totalWithTax) /
      Number(pricing.nights)
    );
  }

  // Sort rooms by price
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const priceA = getPrice(a.id) ?? Infinity;
      const priceB = getPrice(b.id) ?? Infinity;

      return priceA - priceB;
    });
  }, [rooms, availability]);

  // Preserve room metadata when adding availability data.
  const expandedRoom = selectedRoom
    ? {
        ...selectedRoom,
        ...(availability.find(
          (item) => item.id === selectedRoom.id
        ) || {}),
        amenities: selectedRoom.amenities || [],
      }
    : null;

  return (
    <section className="overflow-hidden bg-[#f5f2eb] pt-2 pb-16 sm:pt-8 sm:pb-20">
      <div className="mx-auto max-w-[1600px]">
        {/* Heading */}
        <div className="mb-4 px-6 sm:px-12 lg:px-0">
          <p className="text-[13px] font-semibold tracking-[0.22em] text-[#9a7658]">
            STAY WITH US
          </p>

          <h2 className="mt-3 whitespace-nowrap font-display text-3xl leading-tight text-[#263b30] sm:text-4xl lg:text-5xl">
            Find your place{" "}
            <span className="italic">in the hills.</span>
          </h2>
        </div>

        {/* Loading */}
        {loading && (
          <p className="px-6 py-16 text-center text-sm text-[#71695f]">
            Discovering our rooms...
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="px-6 py-12 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Empty state */}
        {!loading && !error && rooms.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-[#71695f]">
            No accommodation is currently available.
          </p>
        )}

        {/* Room carousel */}
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

      {/* Room details modal */}
      {expandedRoom && (
        <ExpandedRoomCard
          room={expandedRoom}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </section>
  );
}
