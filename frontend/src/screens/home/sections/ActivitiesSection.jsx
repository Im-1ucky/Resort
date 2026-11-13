"use client";

import { useState } from "react";
import { MapPinned } from "lucide-react";
import { activities } from "../data/activities";
import ActivityMarker from "@/components/activities/ActivityMarker";

export default function ActivitiesSection() {
  const [selectedActivity, setSelectedActivity] = useState(activities[0]);

  const directionsUrl = selectedActivity
    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedActivity.latitude},${selectedActivity.longitude}`
    : "#";

  return (
    <section className="overflow-hidden bg-ivory pt-0 pb-16 sm:pb-20">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 px-6 sm:px-12 lg:px-0">
          <p className="text-[13px] font-semibold tracking-[0.22em] text-[#9a7658]">
            EXPLORE THE ESCAPE
          </p>

          <h2 className="mt-2 whitespace-nowrap font-display text-3xl leading-tight text-forest sm:text-4xl lg:text-[42px]">
            The beauty beyond <span className="italic">your stay.</span>
          </h2>
        </div>

        {/* Map and destination details */}
        <div className="grid grid-cols-1 items-stretch gap-5 px-6 sm:px-12 lg:grid-cols-2 lg:gap-6 lg:px-0">
          {/* Interactive map */}
          <div className="relative h-[420px] overflow-hidden rounded-sm sm:h-[460px] lg:h-[480px]">
            <div
              className="absolute inset-0"
              style={{
                transform: "scale(1.8)",
                transformOrigin: "45% 38%",
              }}
            >
              <img
                src="/images/activities/map.png"
                alt="Illustrated map of Chikmagalur"
                className="absolute inset-0 z-0 block h-full w-full select-none object-contain"
                draggable="false"
              />

              {activities.map((activity) => (
                <ActivityMarker
                  key={activity.id}
                  activity={activity}
                  selected={selectedActivity?.id === activity.id}
                  onClick={setSelectedActivity}
                />
              ))}
            </div>
          </div>

          {/* Destination card */}
          <div className="flex h-[420px] flex-col overflow-hidden rounded-sm bg-white sm:h-[460px] lg:h-[480px]">
            {selectedActivity && (
              <>
                <div className="relative h-[45%] shrink-0 overflow-hidden bg-[#e9e4da]">
                  <img
                    src={selectedActivity.image}
                    alt={selectedActivity.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-5">
                  <h3 className="mt-0 font-display text-xl leading-tight text-forest sm:text-2xl">
                    {selectedActivity.title}
                  </h3>

                  <p className="mt-3 text-[17px] leading-6 text-coffee">
                    {selectedActivity.description}
                  </p>

                  <p className="mt-3 text-[16px] font-medium text-coffee-dark">
                    {selectedActivity.price}
                  </p>

                  <div className="mt-auto flex justify-end pt-6">
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-[10px] font-semibold tracking-[0.16em] !text-white transition hover:bg-forest-light"
                    >
                      <MapPinned size={15} className="!text-white" />
                      GET DIRECTIONS
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
