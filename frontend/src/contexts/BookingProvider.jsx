
"use client";

import { createContext, useContext, useState } from "react";

const BookingContext = createContext(null);

function getDefaultDates() {
  const checkIn = new Date();

  // Tomorrow at local midnight
  checkIn.setHours(0, 0, 0, 0);
  checkIn.setDate(checkIn.getDate() + 1);

  // One night later
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 1);

  return { checkIn, checkOut };
}

export function BookingProvider({ children }) {
  const [defaultDates] = useState(getDefaultDates);

  const [checkIn, setCheckIn] = useState(defaultDates.checkIn);
  const [checkOut, setCheckOut] = useState(defaultDates.checkOut);
  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);

  const guests = adults + childrenCount;

  return (
    <BookingContext.Provider
      value={{
        checkIn,
        setCheckIn,
        checkOut,
        setCheckOut,
        adults,
        setAdults,
        childrenCount,
        setChildrenCount,
        guests,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);

  if (!context) {
    throw new Error("useBooking must be used inside BookingProvider");
  }

  return context;
}
