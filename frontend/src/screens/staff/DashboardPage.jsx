
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";
import EnquiryInbox from "@/components/staff/EnquiryInbox";

export default function StaffDashboardPage() {
  const { user } = useStaffAuth();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-ivory px-5 py-8 text-coffee sm:px-10 lg:px-20 lg:py-12">
      <header className="flex flex-col justify-between gap-6 border-b border-[#dedbd2] pb-8 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            title="Go to homepage"
            aria-label="Go to homepage"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-transparent text-coffee transition hover:bg-white"
          >
            <ArrowLeft size={18} />
          </button>

          <h1 className="font-display text-4xl font-medium text-forest sm:text-[42px]">
            Good day, {user?.name || "Staff"}
          </h1>
        </div>

        <div className="text-right">
          <strong className="block text-sm">{user?.name}</strong>
          <span className="text-[10px] tracking-widest text-wood">
            {user?.role}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1500px]">
        <EnquiryInbox />
      </div>
    </main>
  );
}
