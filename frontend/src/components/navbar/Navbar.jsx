"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/services/api";
import { UserRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  const pathname = usePathname();

  if (
    pathname === "/staff/login" ||
    pathname === "/complete-profile" ||
    pathname === "/booking" ||
    pathname === "/payment" ||
    pathname.startsWith("/payment/")
  ) {
    return null;
  }

  async function handleLogout() {
    try {
      // Clear the authentication cookie for every role, including guests.
      await apiFetch("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      // Clear legacy guest session data too.
      sessionStorage.removeItem("guestToken");
      sessionStorage.removeItem("guestIdentifier");

      setUser(null);
      window.dispatchEvent(new Event("guest-auth-changed"));
      router.replace("/");
    }
  }

  const checkSession = useCallback(async () => {
    try {
      const data = await apiFetch("/auth/me");
      setUser(data.user ?? data);
    } catch {
      const guestToken = sessionStorage.getItem("guestToken");
      setUser(guestToken ? { role: "GUEST" } : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();

    window.addEventListener("guest-auth-changed", checkSession);

    return () => {
      window.removeEventListener("guest-auth-changed", checkSession);
    };
  }, [checkSession]);

  const role = user?.role?.toUpperCase();

  const href = !user
    ? "/staff/login"
    : role === "GUEST"
      ? "/my-bookings"
      : role === "ADMIN"
        ? "/staff/admin"
        : "/staff/dashboard";

  const label = !user
    ? "Sign In"
    : role === "GUEST"
      ? "My Bookings"
      : role === "ADMIN"
        ? "Admin"
        : "Dashboard";

  return (
    <header className="absolute inset-x-0 top-0 z-50 w-full">
      <div className="flex h-[60px] w-full items-center justify-between bg-cream pl-3 pr-3 sm:h-[72px] sm:pl-10 sm:pr-6 lg:pl-14 lg:pr-10">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 text-[#332A23] sm:gap-3"
        >
          <img
            src="/images/logo/logo.svg"
            alt="The Estate mountain logo"
            className="h-10 w-14 shrink-0 object-contain sm:h-13 sm:w-38"
          />

          <div className="flex min-w-0 flex-col justify-center gap-1">
            <span className="whitespace-nowrap font-display text-sm leading-none tracking-[0.12em] sm:text-[23px] sm:tracking-[0.16em]">
              THE ESTATE
            </span>
            <span className="whitespace-nowrap text-[6px] font-medium leading-none tracking-[0.18em] sm:text-[10px] sm:tracking-[0.25em]">
              RESORT &amp; STAYS
            </span>
          </div>
        </Link>

        {!loading && (
          <div className="flex shrink-0 items-center gap-2">
            {user && (
              <button
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[#c9b9a8] px-2.5 py-2 text-xs font-semibold text-[#493d33] transition hover:bg-[#eee7dd] sm:gap-2 sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}

            <Link
              href={href}
              aria-label={label}
              title={label}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-coffee px-2.5 py-2 text-xs font-semibold !text-white transition hover:bg-coffee-dark sm:gap-2 sm:rounded-xl sm:px-6 sm:py-3 sm:text-base"
            >
              <UserRound size={17} strokeWidth={2} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
