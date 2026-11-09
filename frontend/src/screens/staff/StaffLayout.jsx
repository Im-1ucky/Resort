
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

  useEffect(() => {
    if (loading) return;

    if (!user && !isLoginPage) router.replace("/staff/login");
    if (user && isLoginPage) router.replace("/staff/dashboard");
  }, [user, loading, isLoginPage, router]);

  if (loading || (!user && !isLoginPage) || (user && isLoginPage)) {
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
  return (
    <StaffAuthProvider>
      <StaffGuard>{children}</StaffGuard>
    </StaffAuthProvider>
  );
}
