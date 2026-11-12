"use client";

import { useState } from "react";
import EventCard from "@/components/events/EventCard";
import ExpandedEventCard from "@/components/events/ExpandedEventCard";

const events = [
  {
    id: 1,
    title: "Weddings",
    image: "/images/events/weddings/1.jpg",
    images: [
      "/images/events/weddings/1.jpg",
      "/images/events/weddings/2.jpg",
      "/images/events/weddings/3.jpg",
      "/images/events/weddings/4.jpg",
    ],
    description:
      "Make your special day truly unforgettable, set amidst the serene beauty of the hills, our venue offers a beautiful setting for weddings, receptions and intimate celebrations. Every moment becomes a cherished memory, surrounded by nature, elegance and the people who matter most.",
  },
  {
    id: 2,
    title: "Cultural Events",
    image: "/images/events/culturals/1.jpg",
    images: [
      "/images/events/culturals/1.jpg",
      "/images/events/culturals/2.jpg",
      "/images/events/culturals/3.jpg",
      "/images/events/culturals/4.jpg",
    ],
    description:
      "Experience evenings filled with music, art and festive celebrations. From live musical performances and cultural showcases to traditional festivities and vibrant gatherings. Every event brings people together through shared experiences, enjoy an atmosphere where entertainment, culture and relaxation come together.",
  },
  {
    id: 3,
    title: "Conferences",
    image: "/images/events/conferences/1.jpg",
    images: [
      "/images/events/conferences/1.jpg",
      "/images/events/conferences/2.jpg",
      "/images/events/conferences/3.jpg",
      "/images/events/conferences/4.jpg",
    ],
    description:
      "We offer a refreshing setting for professional gatherings, from corporate meetings and conferences to summits, team outings and networking events. Our serene surroundings provide the perfect balance of focus, comfort and relaxation. Step away from the usual office environment, exchange ideas, build connections and make every gathering meaningful.",
  },
  {
    id: 4,
    title: "Celebrations",
    image: "/images/events/celebrations/1.jpg",
    images: [
      "/images/events/celebrations/1.jpg",
      "/images/events/celebrations/2.jpg",
      "/images/events/celebrations/3.jpg",
      "/images/events/celebrations/4.jpg",
    ],
    description:
      "Celebrate life's special moments, surrounded by the beauty and tranquillity of the hills. From lively birthday parties and family reunions to private gatherings and festive celebrations, we make every occasion memorable. Bring your favourite people together, create lasting memories and let every celebration feel special.",
  },
  {
    id: 5,
    title: "Picnics",
    image: "/images/events/picnic/1.jpg",
    images: [
      "/images/events/picnic/1.jpg",
      "/images/events/picnic/2.jpg",
      "/images/events/picnic/3.jpg",
    ],
    description:
      "Enjoy a refreshing escape with leisurely picnics and memorable day outings. Surrounded by scenic landscapes and the tranquillity of nature, it's the perfect setting for families, couples and friends to unwind, while children can explore, play and enjoy the outdoors. Share good food, spend quality time together and create memories across generations.",
  },
];

export default function EventsSection({ onEventEnquire }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <section className="overflow-hidden bg-[#f5f2eb] pt-0 pb-16 sm:pb-20">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 px-6 sm:px-12 lg:px-0">
          <p className="text-[13px] font-semibold tracking-[0.22em] text-[#9a7658]">
            LIFE AT THE ESTATE
          </p>

          <h2 className="mt-3 whitespace-nowrap font-display text-3xl leading-tight text-[#263b30] sm:text-4xl lg:text-5xl">
            Where moments{" "}
            <span className="italic">come alive.</span>
          </h2>
        </div>

        {/* Event cards */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      </div>

      {selectedEvent && (
        <ExpandedEventCard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEnquire={(event) => {
            setSelectedEvent(null);

            window.dispatchEvent(
              new CustomEvent("open-enquiry", {
                detail: {
                  eventTitle: event.title,
                },
              }),
            );
          }}
        />
      )}
    </section>
  );
}
