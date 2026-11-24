"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";

function StaffGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useStaffAuth();

  const isPublicPage =
    pathname === "/staff/login" || pathname === "/staff/reset-password";
  const role = user?.role?.toUpperCase();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!isPublicPage) router.replace("/staff/login");
      return;
    }

    if (role === "GUEST") {
      if (isPublicPage || pathname.startsWith("/staff")) {
        router.replace(
          !user.name || user.name === "Guest"
            ? "/complete-profile"
            : "/my-bookings"
        );
      }
      return;
    }

    if (isPublicPage) {
      router.replace(
        role === "ADMIN" ? "/staff/admin" : "/staff/dashboard"
      );
    }
  }, [user, loading, isPublicPage, pathname, role, router]);

  const shouldRedirect =
    loading ||
    (!user && !isPublicPage) ||
    (user && role === "GUEST") ||
    (user && isPublicPage);

  if (shouldRedirect) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-sm text-sage">
        <span className="size-7 animate-spin rounded-full border-2 border-[#d9ded5] border-t-forest" />
        Loading workspace...
      </div>
    );
  }

  return children;
}

export default function StaffLayout({ children }) {
  return <StaffGuard>{children}</StaffGuard>;
}
