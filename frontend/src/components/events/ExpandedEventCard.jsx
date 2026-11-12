"use client";

import { useEffect, useRef, useState } from "react";
import { X, Maximize2, MessageCircle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

export default function ExpandedEventCard({
  event,
  onClose,
  onEnquire,
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const galleryRef = useRef(null);
  const lightboxRef = useRef(null);

  const images = event.images?.length
    ? event.images
    : [event.image].filter(Boolean);

  function goToImage(index, ref = galleryRef) {
    const gallery = ref.current;
    if (!gallery) return;

    gallery.scrollTo({
      left: index * gallery.clientWidth,
      behavior: "smooth",
    });

    setActiveImage(index);
  }

  function EventImageLightbox({ images, startIndex, eventTitle, onClose }) {
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
      ],
    );

    const [activeIndex, setActiveIndex] = useState(startIndex);

    useEffect(() => {
      if (!emblaApi) return;

      emblaApi.scrollTo(startIndex, true);
      setActiveIndex(startIndex);
    }, [emblaApi, startIndex]);

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

    useEffect(() => {
      function handleKeyDown(event) {
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
    }, [emblaApi]);

    return (
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-3 sm:p-6"
        onClick={onClose}
      >
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

        {/* Embla image carousel */}
        <div
          className="h-full w-full overflow-hidden"
          ref={emblaRef}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex h-full">
            {images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    onClose();
                  }
                }}
                className="flex h-full w-full flex-[0_0_100%] items-center justify-center"
              >
                <img
                  src={image}
                  alt={`${eventTitle} ${index + 1}`}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  emblaApi?.scrollTo(index);
                }}
                aria-label={`View image ${index + 1}`}
                className={`h-2 rounded-full transition-all ${
                  activeIndex === index
                    ? "w-6 bg-white"
                    : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }


  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (lightboxOpen) {
          setLightboxOpen(false);
        } else {
          onClose();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, lightboxOpen]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("event-modal-state", {
        detail: { open: true },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("event-modal-state", {
          detail: { open: false },
        }),
      );
    };
  }, []);

  // Keep fullscreen gallery on the currently selected image.
  useEffect(() => {
    if (!lightboxOpen || !lightboxRef.current) return;

    lightboxRef.current.scrollTo({
      left: activeImage * lightboxRef.current.clientWidth,
      behavior: "instant",
    });
  }, [lightboxOpen, activeImage]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[#f5f2eb] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close event details"
          className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
        >
          <X size={21} />
        </button>

        {/* Event image gallery */}
        <div className="relative h-48 flex-none overflow-hidden bg-[#dedbd2] sm:h-72 lg:h-[340px]">
          <div
            ref={galleryRef}
            className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
            onScroll={(e) => {
              const width = e.currentTarget.clientWidth;

              if (width) {
                setActiveImage(
                  Math.round(e.currentTarget.scrollLeft / width),
                );
              }
            }}
          >
            {images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="relative h-full w-full flex-none snap-center"
              >
                <img
                  src={image}
                  alt={`${event.title} - ${index + 1}`}
                  onClick={() => {
                    setActiveImage(index);
                    setLightboxOpen(true);
                  }}
                  className="h-full w-full cursor-zoom-in object-cover"
                />
              </div>
            ))}
          </div>

          {/* Pagination dots */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
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

          {/* Fullscreen button */}
          <button
            onClick={() => setLightboxOpen(true)}
            aria-label="View full-screen image"
            className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-black/50 text-white"
          >
            <Maximize2 size={17} />
          </button>
        </div>

        {/* Event description */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-2 sm:px-8 sm:pt-8 sm:pb-2 lg:px-9">
          <h2 className="font-display text-2xl text-[#203c30] sm:text-4xl">
            {event.title}
          </h2>

          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#625f55] sm:text-base">
            {event.description}
          </p>
        </div>

        {/* Enquire Now */}
        <div className="flex justify-end px-5 pt-1 pb-4 sm:px-8 lg:px-9">
          <button
            type="button"
            onClick={() => onEnquire?.(event)}
            className="flex items-center justify-center gap-3 rounded-md bg-[#382F27] px-7 py-3.5 text-[10px] font-semibold tracking-[0.16em] text-[#F5F2EA] transition hover:bg-[#241C17]"
          >
            <MessageCircle size={17} strokeWidth={1.7} />
            ENQUIRE
          </button>
        </div>
      </div>

      {/* Full-screen image viewer */}
      {lightboxOpen && (
        <EventImageLightbox
          images={images}
          startIndex={activeImage}
          eventTitle={event.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
