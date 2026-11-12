"use client";

import { MapPin } from "lucide-react";

export default function ActivityMarker({
  activity,
  onClick,
  selected = false,
}) {
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${activity.x}%`,
        top: `${activity.y}%`,
      }}
    >
      <button
        type="button"
        aria-label={`Explore ${activity.title}`}
        onClick={() => onClick(activity)}
        className={`group relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#F5F2EA] shadow-lg transition-all duration-200 hover:z-20 hover:scale-110 ${
          selected
            ? "scale-110 bg-coffee text-[#F5F2EA]"
            : "bg-[#A58A62] text-white hover:bg-coffee-dark"
        }`}
      >
        <MapPin size={10} fill="currentColor" strokeWidth={1.0} />

        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-coffee px-2 py-1 text-[9px] font-medium tracking-wide text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
          {activity.title}
        </span>
      </button>
    </div>
  );
}
