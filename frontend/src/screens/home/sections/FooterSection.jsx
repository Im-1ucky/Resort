export default function FooterSection() {
  return (
    <footer className="bg-forest px-6 py-5 text-ivory sm:px-12">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-lg tracking-wide">
            THE ESTATE
          </h2>

          <p className="text-[11px] font-medium tracking-[0.2em] text-sand">
            CHIKMAGALUR · KARNATAKA
          </p>
        </div>

        <div className="my-4 h-px bg-sage/40" />

        <p className="text-[12px] text-cream">
          © {new Date().getFullYear()} The Estate · All rights reserved.
        </p>
      </div>
    </footer>
  );
}
