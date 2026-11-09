
"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
          { credentials: "include" }
        );

        if (response.ok) {
          const data = await response.json();
          setUser(data.user ?? data);
        }
      } catch (error) {
        console.error("Session check failed:", error);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  return (
    <header className="absolute inset-x-0 top-0 z-50 w-full">
      <div className="flex h-[60px] w-full items-center justify-between bg-cream pl-3 pr-3 sm:h-[72px] sm:pl-10 sm:pr-6 lg:pl-14 lg:pr-10">

        {/* Brand */}
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 text-[#332A23] sm:gap-3"
        >
          <img
            src="/images/logo/logo.svg"
            alt="The Estate mountain logo"
            className="h-10 w-14 shrink-0 object-contain sm:h-13 sm:w-28"
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

        {/* Login / Profile */}
        {!loading && (
          <Link
            href={user ? "/profile" : "/staff/login"}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-coffee px-3 py-2 text-xs font-semibold !text-white transition hover:bg-coffee-dark sm:gap-2 sm:rounded-xl sm:px-6 sm:py-3 sm:text-base"
          >
            <UserRound size={17} strokeWidth={2} />
            {user ? "Profile" : "Login"}
          </Link>
        )}
      </div>
    </header>
  );
}
