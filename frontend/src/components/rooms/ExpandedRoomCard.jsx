
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import {
  formatIndianDate,
  parseIndianDate,
  formatApiDate,
} from "@/utils/date";
import { useBooking } from "@/contexts/BookingProvider";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import {
  Wifi,
  Bath,
  Snowflake,
  Droplets,
  ShowerHead,
  Coffee,
  Flower2,
  Waves,
  Wine,
  Sparkles,
  X,
  Maximize2,
} from "lucide-react";

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getDisplayName(room) {
  const name = room.name?.toUpperCase();

  if (name === "ROOM") return "Standard Room";
  if (name === "DELUXE_TEST") return "Deluxe Room";
  if (name === "VILLA") return "Standard Villa";
  if (name === "DELUXE VILLA") return "Deluxe Villa";

  return room.name;
}

// Local room image mapping
const localRoomImages = {
  ROOM: [
    "/images/rooms/standardroom/1.jpg",
    "/images/rooms/standardroom/2.jpg",
    "/images/rooms/standardroom/3.jpg",
  ],

  DELUXE_TEST: [
    "/images/rooms/deluxeroom/1.jpg",
    "/images/rooms/deluxeroom/2.png",
    "/images/rooms/deluxeroom/3.png",
  ],

  VILLA: [
    "/images/rooms/standardvilla/1.jpg",
    "/images/rooms/standardvilla/2.jpg",
    "/images/rooms/standardvilla/3.jpg",
  ],

  "DELUXE VILLA": [
    "/images/rooms/deluxevilla/1.jpg",
    "/images/rooms/deluxevilla/2.jpg",
    "/images/rooms/deluxevilla/3.jpg",
  ],
};

function getDatabaseImages(room) {
  if (!Array.isArray(room.images)) return [];

  return room.images
    .map((image) =>
      typeof image === "string" ? image : image?.url
    )
    .filter(Boolean);
}

function getImages(room) {
  const name = room.name?.toUpperCase();

  const localImages = localRoomImages[name] || [];
  const databaseImages = getDatabaseImages(room);

  return [
    ...new Set([
      ...localImages,
      ...databaseImages,
    ]),
  ];
}

const amenityIcons = {
  "Wi-Fi": Wifi,
  Jacuzzi: Bath,
  Bathtub: Bath,
  AC: Snowflake,
  "Hot Water": Droplets,
  "Private Bathroom": ShowerHead,
  Breakfast: Coffee,
  Balcony: Flower2,
  "Private Balcony": Flower2,
  "Garden Access": Flower2,
  "Pool Access": Waves,
  "Bar Access": Wine,
};

const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-[#e3d9ca] bg-white px-2.5 text-[13px] text-[#263b30] outline-none transition focus:border-[#263b30] focus:ring-1 focus:ring-[#263b30]/10";

const labelClass =
  "mb-1 block text-[9px] font-medium uppercase tracking-wider text-[#8b8578]";

/* -------------------------------------------------------------------------- */
/*                         Full-screen image lightbox                         */
/* -------------------------------------------------------------------------- */

function RoomImageLightbox({
  images,
  startIndex,
  roomName,
  onClose,
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: "center",
      containScroll: "trimSnaps",
      dragFree: false,
    },
    [
      WheelGesturesPlugin({
        forceWheelAxis: "x",
      }),
    ]
  );

  const [activeIndex, setActiveIndex] = useState(startIndex);

  // Start at the image that was clicked.
  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.scrollTo(startIndex, true);
    setActiveIndex(startIndex);
  }, [emblaApi, startIndex]);

  // Keep the image counter synchronized.
  useEffect(() => {
    if (!emblaApi) return;

    const updateIndex = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
    };

    emblaApi.on("select", updateIndex);
    updateIndex();

    return () => {
      emblaApi.off("select", updateIndex);
    };
  }, [emblaApi]);

  // Keyboard controls.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (!emblaApi) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        emblaApi.scrollPrev();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        emblaApi.scrollNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emblaApi, onClose]);

  if (!images.length) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-3 sm:p-6"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close image viewer"
        className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={24} />
      </button>

      {/* Image carousel */}
      <div
        className="h-full w-full overflow-hidden"
        ref={emblaRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-full">
          {images.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className="flex h-full w-full flex-[0_0_100%] items-center justify-center"
            >
              <img
                src={image}
                alt={`${roomName} ${index + 1}`}
                draggable="false"
                className="max-h-full max-w-full select-none object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

//Expanded room card

export default function ExpandedRoomCard({ room, onClose }) {
  const {
    checkIn,
    setCheckIn,
    checkOut,
    setCheckOut,
    adults,
    setAdults,
    childrenCount,
    setChildrenCount,
  } = useBooking();

  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [checkInInput, setCheckInInput] = useState(
    formatIndianDate(checkIn)
  );

  const [checkOutInput, setCheckOutInput] = useState(
    formatIndianDate(checkOut)
  );

  const galleryRef = useRef(null);

  const images = useMemo(
    () => getImages(room || {}),
    [room]
  );

  const maxGuests = room?.maxGuests || 4;

  // Keep displayed dates synchronized with booking state.
  useEffect(() => {
    setCheckInInput(formatIndianDate(checkIn));
    setCheckOutInput(formatIndianDate(checkOut));
  }, [checkIn, checkOut]);

  // Reset gallery when the selected room changes.
  useEffect(() => {
    setActiveImage(0);
    setLightboxOpen(false);
    galleryRef.current?.scrollTo({ left: 0 });
  }, [room?.id]);

  // Escape closes the lightbox first, then the room modal.
  useEffect(() => {
    if (!room) return;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !lightboxOpen) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [room, onClose, lightboxOpen]);

  // Prevent background scrolling while the lightbox is open.
  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

  if (!room) return null;

  const nights = Math.max(
    1,
    Math.round(
      (checkOut.getTime() - checkIn.getTime()) / 86400000
    )
  );

  const pricing = room.pricing || {};
  const total = Number(pricing.totalWithTax || 0);
  const baseTotal = Number(pricing.baseTotal || 0);
  const gstTotal = Number(pricing.gstTotal || 0);

  function changeCheckIn(value) {
    if (!value) return;

    const nextCheckIn = new Date(`${value}T00:00:00`);
    setCheckIn(nextCheckIn);

    if (nextCheckIn >= checkOut) {
      setCheckOut(addDays(nextCheckIn, 1));
    }
  }

  function changeCheckOut(value) {
    if (!value) return;

    const nextCheckOut = new Date(`${value}T00:00:00`);

    if (nextCheckOut > checkIn) {
      setCheckOut(nextCheckOut);
    }
  }

  function changeAdults(value) {
    const next = Math.max(
      1,
      Math.min(
        Number(value) || 1,
        maxGuests - childrenCount
      )
    );

    setAdults(next);
  }

  function changeChildren(value) {
    const next = Math.max(
      0,
      Math.min(
        Number(value) || 0,
        maxGuests - adults
      )
    );

    setChildrenCount(next);
  }

  function goToImage(index) {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const next = Math.max(
      0,
      Math.min(index, images.length - 1)
    );

    gallery.scrollTo({
      left: next * gallery.clientWidth,
      behavior: "smooth",
    });

    setActiveImage(next);
  }

  function openLightbox(index) {
    setActiveImage(index);
    setLightboxOpen(true);
  }

  function handleBook() {
    const params = new URLSearchParams({
      roomTypeId: room.id,
      quantity: "1",
      checkIn: formatApiDate(checkIn),
      checkOut: formatApiDate(checkOut),
      adults: String(adults),
      children: String(childrenCount),
    });

    window.location.href = `/booking?${params.toString()}`;
  }

  function handleImageError(event, image, index) {
    const databaseImages = getDatabaseImages(room);
    const isLocalImage = image.startsWith("/images/rooms/");

    const fallback = isLocalImage
      ? databaseImages[index] || "/images/hero/resort-hero.jpg"
      : "/images/hero/resort-hero.jpg";

    if (image !== fallback) {
      event.currentTarget.onerror = null;
      event.currentTarget.src = fallback;
    } else {
      event.currentTarget.style.display = "none";
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={getDisplayName(room)}
        className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[#f5f2eb] shadow-2xl sm:max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close room details */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close room details"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-xl text-white backdrop-blur transition hover:bg-black/75 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
        >
          ×
        </button>

        {/* Image gallery */}
        <div className="relative h-32 w-full flex-none overflow-hidden bg-[#dedbd2] sm:h-64 lg:h-[300px]">
          <div
            ref={galleryRef}
            className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
            onScroll={(event) => {
              const width = event.currentTarget.clientWidth;

              if (width) {
                setActiveImage(
                  Math.round(
                    event.currentTarget.scrollLeft / width
                  )
                );
              }
            }}
          >
            {images.length > 0 ? (
              images.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="relative h-full w-full flex-none snap-center"
                >
                  <img
                    src={image}
                    alt={`${getDisplayName(room)} ${index + 1}`}
                    onError={(event) =>
                      handleImageError(event, image, index)
                    }
                    onClick={() => openLightbox(index)}
                    className="h-full w-full cursor-zoom-in object-contain"
                  />

                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    aria-label="View image full screen"
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                  >
                    <Maximize2 size={17} />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-[#777]">
                Room image unavailable
              </div>
            )}
          </div>

          {/* Gallery indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToImage(index)}
                  aria-label={`View image ${index + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    activeImage === index
                      ? "w-6 bg-white"
                      : "w-2 bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scrollable room content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 p-4 sm:gap-6 sm:p-7 md:grid-cols-[1.3fr_0.7fr] lg:gap-8 lg:p-9">

            {/* Room information */}
            <div>
              <h2 className="font-display text-2xl text-[#203c30] sm:text-4xl">
                {getDisplayName(room)}
              </h2>

              {/* Capacity and area */}
              <div className="mt-3 grid grid-cols-2 gap-3 border-y border-[#d8d2c5] py-3 sm:mt-4 sm:gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#858176] sm:text-[10px]">
                    Maximum guests
                  </p>

                  <p className="mt-1 text-sm text-[#203c30] sm:text-base">
                    Up to {maxGuests} guests
                  </p>
                </div>

                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#858176] sm:text-[10px]">
                    Room area
                  </p>

                  <p className="mt-1 text-sm text-[#203c30] sm:text-base">
                    {room.area
                      ? `${room.area} sq. ft.`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Amenities */}
              {room.amenities?.length > 0 && (
                <div className="mt-4 sm:mt-5">
                  <h3 className="mb-3 font-display text-lg text-[#263b30] sm:text-xl">
                    Amenities
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {room.amenities.map((item, index) => {
                      const name =
                        typeof item === "string"
                          ? item
                          : item.name;

                      const Icon =
                        amenityIcons[name] || Sparkles;

                      return (
                        <div
                          key={`${name}-${index}`}
                          className="group inline-flex items-center gap-2 rounded-full border border-[#d9dfd3] bg-[#e9eee5] px-3 py-2 text-xs text-[#354c3d] transition-all duration-200 hover:border-[#263b30] hover:bg-[#263b30] hover:text-[#f5f2eb]"
                        >
                          <Icon
                            size={15}
                            strokeWidth={1.8}
                            className="shrink-0 text-[#8b795e] transition-colors group-hover:text-[#d8c5a3]"
                          />

                          <span className="font-medium">
                            {name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Booking and pricing panel */}
            <aside className="h-fit rounded-xl border border-[#ded8cb] bg-white p-4 sm:p-[18px]">

              {/* Date and guest selectors: desktop only */}
              <div className="hidden md:block">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <label className={labelClass}>
                      Check-in
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/YYYY"
                      maxLength={10}
                      value={checkInInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCheckInInput(value);

                        const parsed = parseIndianDate(value);

                        if (parsed) {
                          changeCheckIn(formatApiDate(parsed));
                        }
                      }}
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={labelClass}>
                      Check-out
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/YYYY"
                      maxLength={10}
                      value={checkOutInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCheckOutInput(value);

                        const parsed = parseIndianDate(value);

                        if (parsed) {
                          changeCheckOut(formatApiDate(parsed));
                        }
                      }}
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={labelClass}>
                      Adults
                    </label>

                    <input
                      type="number"
                      min="1"
                      max={maxGuests - childrenCount}
                      value={adults}
                      onChange={(event) =>
                        changeAdults(event.target.value)
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0">
                    <label className={labelClass}>
                      Children
                    </label>

                    <input
                      type="number"
                      min="0"
                      max={maxGuests - adults}
                      value={childrenCount}
                      onChange={(event) =>
                        changeChildren(event.target.value)
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="border-t border-[#e5e0d6] pt-3 md:mt-4">
                <div className="space-y-2.5 text-sm text-[#77746b]">
                  <div className="flex justify-between">
                    <span>Room price</span>
                    <span>{formatPrice(baseTotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>GST</span>
                    <span>{formatPrice(gstTotal)}</span>
                  </div>

                  <div className="border-t border-[#e5e0d6] pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#203c30]">
                          Total
                        </p>

                        <p className="mt-0.5 text-xs text-[#89867c]">
                          {nights}{" "}
                          {nights === 1 ? "night" : "nights"}
                        </p>
                      </div>

                      <span className="font-display text-2xl font-semibold text-[#203c30]">
                        {formatPrice(total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Book button */}
              <button
                type="button"
                onClick={handleBook}
                className="mt-4 h-11 w-full rounded-lg bg-[#203c30] px-5 text-sm font-medium uppercase tracking-widest text-white transition hover:bg-[#2e5141]"
              >
                Book Now
              </button>
            </aside>
          </div>
        </div>

        {/* Full-screen Embla image viewer */}
        {lightboxOpen && images[activeImage] && (
          <RoomImageLightbox
            images={images}
            startIndex={activeImage}
            roomName={getDisplayName(room)}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
