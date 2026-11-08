
"use client";

function getVariant(room) {
  const name = room.name.toUpperCase();

  if (name === "DELUXE VILLA") return "villa";
  if (name === "VILLA") return "villa";
  if (name === "DELUXE_TEST") return "deluxe";

  return "standard";
}

const variants = {
  standard: {
    border: "border-[#dedbd5]",
  },
  deluxe: {
    border: "border-[#c9b99f]",
  },
  villa: {
    border: "border-[#b9c1ad]",
  },
};

function getDisplayName(room) {
  const name = room.name.toUpperCase();

  if (name === "ROOM") return "Standard Room";
  if (name === "DELUXE_TEST") return "Deluxe Room";
  if (name === "VILLA") return "Standard Villa";
  if (name === "DELUXE VILLA") return "Deluxe Villa";

  return room.name;
}

export default function RoomCard({ room, onSelect, price }) {
  const variant = getVariant(room);
  const style = variants[variant];

  const image =
    room.images?.[0]?.url ||
    room.images?.[0] ||
    "/images/hero/resort-hero.jpg";

  return (
    <article
      onClick={() => onSelect(room)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(room);
        }
      }}
      role="button"
      tabIndex={0}
      className={`group flex w-[340px] flex-none cursor-pointer flex-col overflow-hidden rounded-xl border ${style.border} bg-white text-left transition-shadow duration-300 hover:shadow-xl sm:w-[460px]`}
    >
      {/* Room image */}
      <div className="aspect-[16/8] overflow-hidden bg-[#e7e2d8]">
        <img
          src={image}
          alt={getDisplayName(room)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      {/* Room details */}
      <div className="flex flex-1 flex-col px-5 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-3">
        <h3 className="mb0 font-display text-3xl leading-none text-[#263b30]">
          {getDisplayName(room)}
        </h3>

        {/* Guest capacity and area */}
        <div className="mt-0 grid grid-cols-2 gap-3 border-b border-[#e9e5dc] py-3">
          <div>
            <p className="text-[10px] tracking-[0.15em] text-[#968d80]">
              MAXIMUM GUESTS
            </p>
            <p className="mt-1 text-sm font-medium text-[#263b30]">
              Up to {room.maxGuests} Guests
            </p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.15em] text-[#968d80]">
              ROOM AREA
            </p>
            <p className="mt-1 text-sm font-medium text-[#263b30]">
              {room.area ? `${room.area} sq. ft.` : "Not specified"}
            </p>
          </div>
        </div>

        {/* Price and booking */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <div>
            <p className="text-[10px] tracking-wider text-[#968d80]">
              STARTING FROM
            </p>

            <p className="mt-1 font-display text-2xl text-[#263b30]">
              {price != null
                ? `₹${Math.round(price).toLocaleString("en-IN")}`
                : "—"}
              <span className="ml-1 font-sans text-xs text-[#968d80]">
                / night
              </span>
            </p>
          </div>

          <span className="whitespace-nowrap rounded-lg bg-[#263b30] px-6 py-3 text-sm font-medium text-white transition-colors group-hover:bg-[#405a47]">
            Book Now
          </span>
        </div>
      </div>
    </article>
  );
}
