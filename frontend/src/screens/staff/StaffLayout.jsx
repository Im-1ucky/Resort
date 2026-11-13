"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  StaffAuthProvider,
  useStaffAuth,
} from "@/contexts/StaffAuthProvider";

function StaffGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useStaffAuth();

  const isLoginPage = pathname === "/staff/login";
  const role = user?.role?.toUpperCase();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!isLoginPage) router.replace("/staff/login");
      return;
    }

    if (role === "GUEST") {
      if (isLoginPage || pathname.startsWith("/staff")) {
        router.replace(
          !user.name || user.name === "Guest"
            ? "/complete-profile"
            : "/my-bookings"
        );
      }
      return;
    }

    if (isLoginPage) {
      router.replace(
        role === "ADMIN" ? "/staff/admin" : "/staff/dashboard"
      );
    }
  }, [user, loading, isLoginPage, pathname, role, router]);

  const shouldRedirect =
    loading ||
    (!user && !isLoginPage) ||
    (user && role === "GUEST") ||
    (user && isLoginPage);

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
