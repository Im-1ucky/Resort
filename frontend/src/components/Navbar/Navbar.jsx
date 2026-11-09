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
      <div className="flex h-[76px] w-full items-center justify-between bg-[#FCFBF8] pl-14 pr-4 sm:h-[88px] sm:pl-16 sm:pr-6 lg:pl-18 lg:pr-8 xl:pl-10 xl:pr-10">

        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 text-[#332A23]"
        >
          <img
            src="/images/logo/logo.svg"
            alt="The Estate mountain logo"
            className="h-13 w-28 object-contain"
          />

          <div className="flex flex-col justify-center gap-1">
            <span className="font-display text-lg leading-none tracking-[0.16em] sm:text-[23px]">
              THE ESTATE
            </span>

            <span className="text-[7px] font-medium leading-none tracking-[0.25em] sm:text-[10px]">
              RESORT &amp; STAYS
            </span>
          </div>
        </Link>

        {/* Login / Profile */}
        {!loading && (
          <Link
            href={user ? "/profile" : "/staff/login"}
            className="flex items-center gap-2 rounded-xl bg-coffee px-6 py-3 text-sm font-semibold !text-white transition hover:bg-coffee-dark sm:text-base"
          >
            <UserRound size={19} strokeWidth={2} />
            {user ? "Profile" : "Login"}
          </Link>
        )}
      </div>
    </header>
  );
}
