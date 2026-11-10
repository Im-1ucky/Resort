"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import BookingPage from "@/screens/booking/BookingPage";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";

export default function BookingRoute() {
  const { user, loading } = useStaffAuth();
  const router = useRouter();

  const incompleteProfile =
    user?.role?.toUpperCase() === "GUEST" &&
    (!user.name?.trim() || user.name.trim() === "Guest");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/staff/login");
    } else if (incompleteProfile) {
      router.replace("/complete-profile");
    }
  }, [user, loading, incompleteProfile, router]);

  if (loading || !user || incompleteProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-[#332A23]">
        Checking your profile...
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="p-10">Loading booking...</div>}>
        <BookingPage />
      </Suspense>
    </>
  );
}
