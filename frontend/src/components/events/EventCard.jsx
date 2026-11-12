"use client";

export default function EventCard({ event, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full overflow-hidden rounded-xl bg-white text-left"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#dedbd2]">
        <img
          src={event.image}
          alt={event.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="px-1 py-4">
        <h3 className="font-display text-xl text-[#203c30] transition-colors group-hover:text-[#8b795e]">
          {event.title}
        </h3>
      </div>
    </button>
  );
}
