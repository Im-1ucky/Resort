
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BedDouble,
  RefreshCw,
  LogOut,
  Users,
  CalendarCheck,
  IndianRupee,
  Inbox,
  Plus,
  Save,
  Ban,
  Trash2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/services/api";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";
import EnquiryInbox from "@/components/staff/EnquiryInbox";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "Room inventory", icon: BedDouble },
  { id: "enquiries", label: "Enquiries", icon: Inbox },
];

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function getBookingPages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current - 1, current, current + 1]);

  if (current <= 3) {
    [2, 3, 4].forEach((page) => pages.add(page));
  }

  if (current >= total - 2) {
    [total - 3, total - 2, total - 1].forEach((page) =>
      pages.add(page)
    );
  }

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      result.push("...");
    }

    result.push(page);
  });

  return result;
}

function StatCard({ title, value, detail, icon: Icon }) {
  return (
    <div className="border border-[#e8e4db] bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500">{title}</span>
        <Icon size={18} className="text-wood" />
      </div>

      <p className="mt-4 font-display text-3xl text-forest">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-stone-400">
        {detail}
      </p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading, logout } = useStaffAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [roomCount, setRoomCount] = useState("1");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [guestValues, setGuestValues] = useState({});
  const [physicalValues, setPhysicalValues] = useState({});

  // Booking search and pagination
  const [bookings, setBookings] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [bookingError, setBookingError] = useState("");
  const [bookingSearchInput, setBookingSearchInput] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingSearchOpen, setBookingSearchOpen] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPagination, setBookingPagination] = useState({
    total: 0,
    totalPages: 0,
  });
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/staff/login");
    } else if (user.role !== "ADMIN") {
      router.replace("/staff/dashboard");
    }
  }, [user, authLoading, router]);

  const loadDashboard = useCallback(async () => {
    const data = await apiFetch("/analytics/dashboard");
    setDashboard(data.dashboard);
  }, []);

  const loadInventory = useCallback(async () => {
    const [typesData, roomsData] = await Promise.all([
      apiFetch("/room-types"),
      apiFetch("/rooms"),
    ]);

    const types = typesData.roomTypes || [];
    const physicalRooms = roomsData.rooms || [];

    setRoomTypes(types);
    setRooms(physicalRooms);

    setGuestValues(
      Object.fromEntries(
        types.map((type) => [
          type.id,
          String(type.maxGuests),
        ])
      )
    );

    setPhysicalValues(
      Object.fromEntries(
        types.map((type) => [
          type.id,
          String(
            physicalRooms.filter(
              (room) =>
                room.roomTypeId === type.id && !room.isRetired
            ).length
          ),
        ])
      )
    );
  }, []);

  // Fetch bookings from the backend, 10 at a time.
  const loadBookings = useCallback(async () => {
    setBookingLoading(true);
    setBookingError("");

    try {
      const params = new URLSearchParams({
        page: String(bookingPage),
        limit: "10",
      });

      if (bookingSearch) {
        params.set("search", bookingSearch);
      }

      const data = await apiFetch(`/bookings?${params}`);

      setBookings(data.bookings || []);
      setBookingPagination(
        data.pagination || {
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err) {
      setBookingError(err.message);
    } finally {
      setBookingLoading(false);
    }
  }, [bookingPage, bookingSearch]);

  useEffect(() => {
    if (!authLoading && user?.role === "ADMIN") {
      loadBookings();
    }
  }, [authLoading, user, loadBookings, bookingRefreshKey]);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      await Promise.all([
        loadDashboard(),
        loadInventory(),
      ]);

      setBookingRefreshKey((current) => current + 1);
    } catch (err) {
      console.error("Failed to refresh admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadInventory]);

  useEffect(() => {
    if (!authLoading && user?.role === "ADMIN") {
      refresh();
    }
  }, [authLoading, user, refresh]);

  async function saveMaxGuests(id) {
    const maxGuests = Number(guestValues[id]);

    if (
      !Number.isInteger(maxGuests) ||
      maxGuests < 1 ||
      maxGuests > 50
    ) {
      console.error("Maximum guests must be between 1 and 50.");
      return;
    }

    try {
      await apiFetch(`/room-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ maxGuests }),
      });

      await loadInventory();
    } catch (err) {
      console.error("Failed to update maximum guests:", err);
    }
  }

  async function savePhysicalUnits(id) {
    const totalUnits = Number(physicalValues[id]);

    if (
      !Number.isInteger(totalUnits) ||
      totalUnits < 0 ||
      totalUnits > 500
    ) {
      console.error("Physical units must be between 0 and 500.");
      return;
    }

    try {
      await apiFetch(`/rooms/category/${id}/units`, {
        method: "PATCH",
        body: JSON.stringify({ totalUnits }),
      });

      await loadInventory();
    } catch (err) {
      console.error("Failed to update physical units:", err);
    }
  }

  async function addRoom(event) {
    event.preventDefault();

    const count = Number(roomCount);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 100
    ) {
      console.error("Number of rooms must be between 1 and 100.");
      return;
    }

    if (!roomTypeId) {
      console.error("Please select a room category.");
      return;
    }

    setSavingRoom(true);

    try {
      await apiFetch("/rooms/bulk", {
        method: "POST",
        body: JSON.stringify({ roomTypeId, count }),
      });

      setRoomCount("1");
      setRoomTypeId("");

      await loadInventory();
    } catch (err) {
      console.error("Failed to add rooms:", err);
    } finally {
      setSavingRoom(false);
    }
  }

  async function toggleRoom(room) {
    try {
      await apiFetch(`/rooms/${room.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !room.isActive,
        }),
      });

      await loadInventory();
    } catch (err) {
      console.error("Failed to update room status:", err);
    }
  }

  async function retireRoom(room) {
    const confirmed = window.confirm(
      `Permanently retire room ${room.roomNumber}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await apiFetch(`/rooms/${room.id}`, {
        method: "DELETE",
      });

      await loadInventory();
    } catch (err) {
      console.error("Failed to retire room:", err);
    }
  }

  function handleBookingSearch(event) {
    event.preventDefault();

    setBookingPage(1);
    setBookingSearch(bookingSearchInput.trim());
  }

  function clearBookingSearch() {
    setBookingSearchInput("");
    setBookingSearch("");
    setBookingPage(1);
  }

  if (authLoading || !user || user.role !== "ADMIN") {
    return (
      <div className="grid min-h-screen place-items-center bg-ivory text-sm text-sage">
        Loading admin workspace...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-ivory text-coffee lg:flex">
      <aside className="flex w-full shrink-0 flex-col border-b border-[#dedbd2] bg-white lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-r">
        <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-1 lg:flex-col">
          <button
            onClick={() => router.push("/")}
            className="mb-3 flex shrink-0 items-center gap-3 border-b border-[#eeeae2] px-3 py-4 text-xs font-semibold text-stone-500 transition hover:text-forest"
          >
            <ChevronLeft size={17} />
            Back to Home
          </button>

          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex shrink-0 items-center gap-3 px-4 py-3 text-left text-xs transition ${
                activeSection === id
                  ? "bg-forest text-white"
                  : "text-stone-500 hover:bg-ivory hover:text-forest"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden border-t border-[#eeeae2] p-5 lg:block">
          <p className="truncate text-xs font-semibold">
            {user.name}
          </p>

          <p className="mt-1 text-[9px] tracking-widest text-wood">
            {user.role}
          </p>

          <button
            onClick={logout}
            className="mt-5 flex items-center gap-2 text-xs text-stone-500 transition hover:text-red-600"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dedbd2] pb-7">
          <div>
            <h1 className="mt-2 font-display text-4xl text-forest">
              Welcome back, {user.name}.
            </h1>
          </div>

          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh dashboard"
            className="grid size-11 place-items-center rounded-full bg-coffee text-white transition hover:bg-wood disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </header>

        {loading ? (
          <div className="py-24 text-center text-sm text-stone-500">
            Loading workspace...
          </div>
        ) : activeSection === "overview" ? (
          <div className="mt-8">
            {/* Overview statistics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total bookings"
                value={dashboard?.bookings?.total ?? 0}
                detail={`${dashboard?.bookings?.confirmed ?? 0} confirmed`}
                icon={CalendarCheck}
              />

              <StatCard
                title="Revenue"
                value={formatCurrency(dashboard?.revenue)}
                detail="From confirmed bookings"
                icon={IndianRupee}
              />

              <StatCard
                title="Pending payments"
                value={dashboard?.bookings?.pendingPayments ?? 0}
                detail="Awaiting payment"
                icon={Users}
              />

              <StatCard
                title="Total enquiries"
                value={dashboard?.enquiries?.total ?? 0}
                detail="Across all departments"
                icon={Inbox}
              />
            </div>

            {/* Bookings */}
            <div className="mt-10">
              <div className="border border-[#e8e4db] bg-white">
                <div className="flex flex-col justify-between gap-4 border-b border-[#eeeae2] p-5 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-display text-2xl text-forest">
                      Bookings
                    </h2>

                    <p className="mt-1 text-[10px] text-stone-400">
                      {bookingPagination.total} total reservations
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setBookingSearchOpen((open) => !open)
                    }
                    aria-label={
                      bookingSearchOpen
                        ? "Close booking search"
                        : "Search bookings"
                    }
                    title={
                      bookingSearchOpen
                        ? "Close search"
                        : "Search bookings"
                    }
                    className="grid size-10 place-items-center rounded-full bg-forest text-white transition hover:bg-forest-dark"
                  >
                    {bookingSearchOpen ? (
                      <X size={17} />
                    ) : (
                      <Search size={17} />
                    )}
                  </button>
                </div>

                {/* Search */}
                {bookingSearchOpen && (
                  <form
                    onSubmit={handleBookingSearch}
                    className="flex flex-col gap-3 border-b border-[#eeeae2] px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Search
                        size={17}
                        className="shrink-0 text-forest"
                      />

                      <input
                        type="search"
                        placeholder="Search guest name, email, phone or booking ID..."
                        value={bookingSearchInput}
                        onChange={(event) =>
                          setBookingSearchInput(event.target.value)
                        }
                        className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {bookingSearch && (
                        <button
                          type="button"
                          onClick={clearBookingSearch}
                          className="px-3 py-2 text-xs text-stone-500 transition hover:text-forest"
                        >
                          Clear
                        </button>
                      )}

                      <button
                        type="submit"
                        className="bg-forest px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-dark"
                      >
                        Search
                      </button>
                    </div>
                  </form>
                )}

                {/* Error */}
                {bookingError && (
                  <p className="border-b border-red-100 bg-red-50 p-4 text-xs text-red-700">
                    {bookingError}
                  </p>
                )}

                {/* Booking results */}
                {bookingLoading ? (
                  <p className="p-12 text-center text-xs text-stone-400">
                    Loading bookings...
                  </p>
                ) : bookings.length === 0 ? (
                  <p className="p-12 text-center text-xs text-stone-400">
                    {bookingSearch
                      ? "No matching bookings found."
                      : "No bookings yet."}
                  </p>
                ) : (
                  <>
                    <div>
                      {bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae2] p-5 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-coffee">
                              {booking.guestName}
                            </p>

                            <p className="mt-1 text-[10px] text-stone-400">
                              {new Date(
                                booking.checkIn
                              ).toLocaleDateString()}{" "}
                              –{" "}
                              {new Date(
                                booking.checkOut
                              ).toLocaleDateString()}
                            </p>

                            <p className="mt-1 text-[9px] text-stone-400">
                              ID:{" "}
                              {booking.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-semibold text-coffee">
                              {formatCurrency(booking.totalAmount)}
                            </p>

                            <p className="mt-1 text-[9px] text-wood">
                              {booking.status.replaceAll("_", " ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {bookingPagination.totalPages > 1 && (
                      <div className="flex flex-col justify-between gap-4 border-t border-[#eeeae2] px-5 py-5 sm:flex-row sm:items-center">
                        <p className="text-[10px] text-stone-500">
                          Showing {(bookingPage - 1) * 10 + 1}–
                          {Math.min(
                            bookingPage * 10,
                            bookingPagination.total
                          )}{" "}
                          of {bookingPagination.total} bookings
                        </p>

                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            disabled={bookingPage <= 1}
                            onClick={() =>
                              setBookingPage((page) =>
                                Math.max(1, page - 1)
                              )
                            }
                            aria-label="Previous page"
                            className="grid size-9 place-items-center border border-[#dedbd2] text-forest transition hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronLeft size={16} />
                          </button>

                          {getBookingPages(
                            bookingPage,
                            bookingPagination.totalPages
                          ).map((page, index) =>
                            page === "..." ? (
                              <span
                                key={`ellipsis-${index}`}
                                className="px-2 text-xs text-stone-400"
                              >
                                ...
                              </span>
                            ) : (
                              <button
                                type="button"
                                key={page}
                                onClick={() => setBookingPage(page)}
                                aria-current={
                                  bookingPage === page
                                    ? "page"
                                    : undefined
                                }
                                className={`grid size-9 place-items-center border text-xs transition ${
                                  bookingPage === page
                                    ? "border-forest bg-forest text-white"
                                    : "border-[#dedbd2] text-coffee hover:bg-ivory"
                                }`}
                              >
                                {page}
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            disabled={
                              bookingPage >=
                              bookingPagination.totalPages
                            }
                            onClick={() =>
                              setBookingPage((page) =>
                                Math.min(
                                  bookingPagination.totalPages,
                                  page + 1
                                )
                              )
                            }
                            aria-label="Next page"
                            className="grid size-9 place-items-center border border-[#dedbd2] text-forest transition hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : activeSection === "enquiries" ? (
          <EnquiryInbox showRefresh={false} />
        ) : (
          <div className="mt-8 space-y-10">
            {/* Room categories */}
            <section>
              <div className="mb-5">
                <h2 className="font-display text-2xl text-forest">
                  Room categories
                </h2>
              </div>

              <div className="overflow-x-auto border border-[#e8e4db] bg-white">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="border-b border-[#eeeae2] bg-ivory/60 text-[10px] uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-5 py-4">Room category</th>
                      <th className="px-5 py-4">Physical units</th>
                      <th className="px-5 py-4">Maximum guests</th>
                      <th className="px-5 py-4">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {roomTypes.map((type) => {
                      const physicalCount = rooms.filter(
                        (room) =>
                          room.roomTypeId === type.id &&
                          !room.isRetired
                      ).length;

                      return (
                        <tr
                          key={type.id}
                          className="border-b border-[#eeeae2] last:border-0"
                        >
                          <td className="px-5 py-4">
                            <p className="text-xs font-semibold">
                              {type.name}
                            </p>

                            <p className="mt-1 text-[10px] text-stone-400">
                              {type.isActive ? "Active" : "Inactive"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={
                                physicalValues[type.id] ??
                                physicalCount
                              }
                              onChange={(event) =>
                                setPhysicalValues((current) => ({
                                  ...current,
                                  [type.id]: event.target.value,
                                }))
                              }
                              className="w-20 border border-[#dedbd2] px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                          </td>

                          <td className="px-5 py-4">
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={
                                guestValues[type.id] ??
                                type.maxGuests
                              }
                              onChange={(event) =>
                                setGuestValues((current) => ({
                                  ...current,
                                  [type.id]: event.target.value,
                                }))
                              }
                              className="w-20 border border-[#dedbd2] px-3 py-2 text-sm outline-none focus:border-forest"
                            />
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-3">
                              <button
                                onClick={() =>
                                  savePhysicalUnits(type.id)
                                }
                                className="flex items-center gap-2 text-xs font-semibold text-forest hover:text-wood"
                              >
                                <Save size={14} />
                                Save units
                              </button>

                              <button
                                onClick={() =>
                                  saveMaxGuests(type.id)
                                }
                                className="flex items-center gap-2 text-xs font-semibold text-forest hover:text-wood"
                              >
                                <Save size={14} />
                                Save guests
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Add new rooms */}
            <section>
              <div className="mb-5">
                <h2 className="font-display text-2xl text-forest">
                  Add new rooms
                </h2>

                <p className="mt-1 text-xs text-stone-500">
                  Select a category and specify how many rooms to add.
                  Room numbers will be generated automatically.
                </p>
              </div>

              <form
                onSubmit={addRoom}
                className="grid gap-4 border border-[#e8e4db] bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <div>
                  <label className="mb-2 block text-xs font-semibold">
                    Room category
                  </label>

                  <select
                    required
                    value={roomTypeId}
                    onChange={(event) =>
                      setRoomTypeId(event.target.value)
                    }
                    className="h-11 w-full border border-[#dedbd2] bg-white px-3 text-sm outline-none focus:border-forest"
                  >
                    <option value="">Select category</option>

                    {roomTypes
                      .filter((type) => type.isActive)
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold">
                    Number of rooms
                  </label>

                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={roomCount}
                    onChange={(event) =>
                      setRoomCount(event.target.value)
                    }
                    className="h-11 w-full border border-[#dedbd2] px-3 text-sm outline-none focus:border-forest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingRoom}
                  className="flex h-11 items-center justify-center gap-2 bg-forest px-5 text-xs font-semibold text-white transition hover:bg-forest-dark disabled:opacity-50"
                >
                  <Plus size={15} />
                  {savingRoom ? "Adding..." : "Add rooms"}
                </button>
              </form>
            </section>

            {/* Physical rooms */}
            <section>
              <div className="mb-5">
                <h2 className="font-display text-2xl text-forest">
                  Physical rooms
                </h2>

                <p className="mt-1 text-xs text-stone-500">
                  Block, reactivate or retire individual rooms.
                </p>
              </div>

              <div className="overflow-x-auto border border-[#e8e4db] bg-white">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="border-b border-[#eeeae2] bg-ivory/60 text-[10px] uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-5 py-4">Room</th>
                      <th className="px-5 py-4">Category</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rooms.map((room) => (
                      <tr
                        key={room.id}
                        className="border-b border-[#eeeae2] last:border-0"
                      >
                        <td className="px-5 py-4 text-xs font-semibold">
                          {room.roomNumber}
                        </td>

                        <td className="px-5 py-4 text-xs">
                          {room.roomType?.name}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`text-[10px] font-semibold ${
                              room.isRetired
                                ? "text-stone-400"
                                : room.isActive
                                  ? "text-green-700"
                                  : "text-amber-700"
                            }`}
                          >
                            {room.isRetired
                              ? "Retired"
                              : room.isActive
                                ? "Active"
                                : "Blocked"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {!room.isRetired && (
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => toggleRoom(room)}
                                title={
                                  room.isActive
                                    ? "Block room"
                                    : "Activate room"
                                }
                                className="text-xs text-wood hover:text-forest"
                              >
                                <Ban size={15} />
                              </button>

                              <button
                                onClick={() => retireRoom(room)}
                                title="Retire room"
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rooms.length === 0 && (
                  <p className="p-8 text-center text-xs text-stone-400">
                    No physical rooms registered.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
