"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Inbox,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useStaffAuth } from "@/components/Staff/StaffAuthProvider";

const PAGE_SIZE = 50;

const statusLabels = {
  NEW: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_FOR_GUEST: "Awaiting guest",
  RESOLVED: "Solved",
  CLOSED: "Closed",
};

function getStatusStyle(status) {
  if (["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_GUEST"].includes(status))
    return "bg-amber-100 text-amber-800";

  if (status === "RESOLVED") return "bg-green-100 text-green-800";

  return "bg-stone-200 text-stone-600";
}

function getPageNumbers(current, total) {
  if (total <= 7)
    return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);

  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2)
    [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];

  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) result.push("...");
    result.push(p);
  });

  return result;
}

export default function StaffDashboardPage() {
  const user = useStaffAuth();
  const router = useRouter();

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    pending: 0,
    solved: 0,
  });

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (search) params.set("search", search);

      const data = await apiFetch(`/enquiries?${params}`);
      setEnquiries(data.enquiries || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
    setSearchOpen(false);
  }

  const start = pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, pagination.total);

  return (
    <main className="min-h-screen bg-ivory px-5 py-8 text-coffee sm:px-10 lg:px-20 lg:py-12">
      <header className="flex flex-col justify-between gap-6 border-b border-[#dedbd2] pb-8 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            title="Go back"
            aria-label="Go back"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-transparent text-coffee transition hover:bg-white"
          >
            <ArrowLeft size={18} />
          </button>

          <h1 className="font-display text-4xl font-medium text-forest sm:text-[42px]">
            Good day, {user?.name || "Staff"}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <strong className="block text-sm">{user?.name}</strong>
            <span className="text-[10px] tracking-widest text-wood">
              {user?.role}
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-12 w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-3xl text-forest">Enquiries</h2>
            <p className="mt-1 text-xs text-stone-500">
              {pagination.total} total · {pagination.pending} pending ·{" "}
              {pagination.solved} solved / closed
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search enquiries"
              className="grid size-11 place-items-center rounded-full bg-forest text-white transition hover:bg-forest-dark"
            >
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            <button
              onClick={loadEnquiries}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-coffee text-white transition-colors hover:bg-coffee-dark"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <form
            onSubmit={handleSearch}
            className="mb-5 flex items-center gap-3 rounded-full border border-coffee/20 bg-white px-5 py-2"
          >
            <Search size={18} className="shrink-0 text-forest" />

            <input
              type="search"
              placeholder="Search guest name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-xs text-stone-500 hover:text-forest"
              >
                Clear
              </button>
            )}

            <button
              type="submit"
              aria-label="Search enquiries"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-forest text-white transition hover:bg-forest-dark"
            >
              <Search className="size-4" />
            </button>
          </form>
        )}

        {error && (
          <p className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="py-20 text-center text-sm text-stone-500">
            Loading enquiries...
          </div>
        ) : enquiries.length === 0 ? (
          <div className="grid justify-items-center gap-3 border border-[#dedbd2] py-20 text-center">
            <Inbox size={30} className="text-sage" />
            <h3 className="font-display text-2xl text-forest">
              {search ? "No matching enquiries" : "No enquiries yet"}
            </h3>
            <p className="text-xs text-stone-500">
              {search
                ? "Try another name or email address."
                : "New guest enquiries will appear here."}
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-[#dedbd2]">
              {enquiries.map((enquiry) => (
                <button
                  key={enquiry.id}
                  onClick={() =>
                    router.push(`/staff/enquiries/${enquiry.id}`)
                  }
                  className="flex w-full flex-col justify-between gap-2 border-b border-[#dedbd2] px-4 py-3 text-left transition hover:bg-white/70 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <strong className="text-sm text-coffee">
                      {enquiry.guestName}
                    </strong>

                    <span className="text-xs font-semibold text-forest">
                      {enquiry.subject || "Guest enquiry"}
                    </span>

                    <p className="line-clamp-2 text-xs text-stone-500">
                      {enquiry.messages?.[0]?.content || "No message available"}
                    </p>
                  </div>

                  <div className="flex min-w-36 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <span
                      className={`rounded-sm px-2.5 py-1.5 text-[10px] font-semibold ${getStatusStyle(enquiry.status)}`}
                    >
                      {statusLabels[enquiry.status] || enquiry.status}
                    </span>

                    <span className="text-[10px] text-stone-500">
                      {enquiry._count?.messages || 0} messages
                    </span>

                    {enquiry.assignedTo && (
                      <span className="text-[10px] text-stone-500">
                        Assigned: {enquiry.assignedTo.name}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col justify-end gap-4 py-6 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="grid size-9 place-items-center border border-[#dedbd2] bg-white text-forest disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers(page, pagination.totalPages).map((item, index) =>
                  item === "..." ? (
                    <span key={`dots-${index}`} className="px-2 text-stone-500">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      className={`grid size-9 place-items-center border text-xs ${
                        page === item
                          ? "border-forest bg-forest text-white"
                          : "border-[#dedbd2] bg-white text-coffee hover:bg-cream"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="grid size-9 place-items-center border border-[#dedbd2] bg-white text-forest disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
