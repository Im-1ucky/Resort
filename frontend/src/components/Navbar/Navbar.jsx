"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { label: "Rooms", href: "/rooms" },
  { label: "The Grounds", href: "/grounds" },
  { label: "Weddings & Events", href: "/events" },
  { label: "Visit", href: "/location" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setMenuOpen(false);

  const isActive = (href) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="relative z-50 bg-ivory text-forest">
      <div className="mx-auto flex h-[72px] items-center justify-between px-5 sm:h-[78px] sm:px-8 lg:h-[82px] lg:px-12 xl:px-16">

        {/* Brand */}
        <Link href="/" onClick={closeMenu} className="shrink-0">
          <span className="block font-display text-[23px] tracking-[0.16em] sm:text-[27px] sm:tracking-[0.18em]">
            THE ESTATE
          </span>
          <span className="mt-1 block text-center text-[7px] tracking-[0.38em] text-wood sm:text-[8px] sm:tracking-[0.42em]">
            CHIKKAMAGALURU
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-6 lg:flex xl:gap-9">
          {links.map((link) => {
            const active = isActive(link.href);

            return (
              <Link
                key={link.label}
                href={link.href}
                className={`group relative py-2 text-[12px] tracking-wide transition-colors duration-200 hover:text-wood ${
                  active ? "text-wood" : "text-forest"
                }`}
              >
                {link.label}
                <span
                  className={`absolute bottom-0 left-0 h-px bg-wood transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* Desktop availability */}
        <Link
          href="/rooms"
          className="hidden rounded-full bg-coffee px-7 py-3.5 text-[10px] font-medium tracking-[0.12em] text-[#f4f1ea] transition-colors duration-300 hover:bg-coffee-dark lg:inline-flex"
        >
          CHECK AVAILABILITY
        </Link>

        {/* Mobile / tablet menu button */}
        <button
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-[6px] rounded-full border border-forest/20 transition-colors hover:bg-forest/5 lg:hidden"
        >
          <span
            className={`h-px w-5 bg-forest transition-transform duration-300 ${
              menuOpen ? "translate-y-[3.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-px w-5 bg-forest transition-transform duration-300 ${
              menuOpen ? "-translate-y-[3.5px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile / tablet navigation */}
      <div
        id="mobile-navigation"
        className={`absolute left-0 top-full w-full overflow-hidden border-t border-forest/10 bg-ivory shadow-lg transition-all duration-300 lg:hidden ${
          menuOpen
            ? "visible max-h-[440px] opacity-100"
            : "invisible max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col px-6 py-4 sm:px-8">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={closeMenu}
              className={`border-b border-forest/10 py-4 text-sm transition-colors hover:text-wood ${
                isActive(link.href) ? "text-wood" : "text-forest"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/rooms"
            onClick={closeMenu}
            className="mt-5 rounded-full bg-coffee px-6 py-4 text-center text-[10px] font-medium tracking-[0.14em] text-[#f4f1ea] transition-colors hover:bg-coffee-dark"
          >
            CHECK AVAILABILITY
          </Link>
        </nav>
      </div>
    </header>
  );
}
