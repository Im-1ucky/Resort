import Link from "next/link";

export default function Navbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-50 text-ivory">
      <div className="flex h-[76px] w-full items-center justify-between px-6 sm:px-10 lg:px-12 xl:px-16">

        {/* Brand */}
        <Link href="/" className="shrink-0">
          <span className="block font-display text-xl tracking-[0.18em] sm:text-2xl">
            THE ESTATE
          </span>
          <span className="mt-0.5 block text-[7px] tracking-[0.38em] text-ivory/70">
            CHIKKAMAGALURU
          </span>
        </Link>

        <nav className="flex items-center gap-7 sm:gap-10">
          <Link
            href="/#contact"
            className="!text-white text-xs font-semibold tracking-[0.12em] transition hover:!text-[#A65D45]"
          >
            CONTACT
          </Link>

          <Link
            href="/staff/login"
            className="border border-white/70 px-6 py-2.5 text-xs tracking-[0.12em] text-white transition hover:border-white hover:bg-white/10"
          >
            LOGIN
          </Link>
        </nav>
      </div>
    </header>
  );
}
