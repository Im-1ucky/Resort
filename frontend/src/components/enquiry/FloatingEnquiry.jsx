"use client";

import { MessageCircle, X, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/services/api";

export default function FloatingEnquiry() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [enquirySubject, setEnquirySubject] = useState("Website enquiry");
  const [isEventOpen, setIsEventOpen] = useState(false);

  const panelRef = useRef(null);

  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    content: "",
  });

  // Open enquiry panel with optional event details.
  useEffect(() => {
    function handleOpenEnquiry(event) {
      const eventTitle = event.detail?.eventTitle;

      setEnquirySubject(
        eventTitle ? `${eventTitle} enquiry` : "Website enquiry",
      );

      setForm((previous) => ({
        ...previous,
        content: eventTitle
          ? `I'm interested in enquiring about ${eventTitle} at The Estate.\n\n`
          : previous.content,
      }));

      setError("");
      setSuccess(false);
      setIsOpen(true);
    }

    window.addEventListener("open-enquiry", handleOpenEnquiry);

    return () => {
      window.removeEventListener("open-enquiry", handleOpenEnquiry);
    };
  }, []);

  useEffect(() => {
    function handleEventModal(event) {
      setIsEventOpen(event.detail?.open ?? false);
    }

    window.addEventListener("event-modal-state", handleEventModal);

    return () => {
      window.removeEventListener("event-modal-state", handleEventModal);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await apiFetch("/enquiries", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          subject: enquirySubject,
          guestPhone: form.guestPhone.trim() || undefined,
        }),
      });

      setSuccess(true);

      setForm({
        guestName: "",
        guestEmail: "",
        guestPhone: "",
        content: "",
      });

      setEnquirySubject("Website enquiry");
    } catch (err) {
      setError(err.message || "Unable to send your enquiry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-[110]">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] max-w-[380px] overflow-hidden rounded-xl border border-[#D8CFC1] bg-[#F5F2EA] text-[#382F27] shadow-2xl">
          <div className="max-h-[70vh] overflow-y-auto p-5">
            {success ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#382F27] text-[#F5F2EA]">
                  <Check size={24} strokeWidth={2} />
                </div>

                <h3 className="font-display text-xl">
                  Thank You!
                </h3>

                <p className="mt-2 text-sm text-[#74695D]">
                  Your enquiry has been received. Our team will get
                  back to you soon.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setIsOpen(false);
                  }}
                  className="mt-6 border border-[#382F27] px-6 py-2 text-[10px] font-semibold tracking-[0.15em] transition hover:bg-[#382F27] hover:text-[#F5F2EA]"
                >
                  CLOSE
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">
                    How can we help?
                  </h3>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close enquiry panel"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#382F27] transition hover:bg-[#E8E1D6]"
                  >
                    <X size={20} strokeWidth={1.8} />
                  </button>
                </div>

                <p className="mt-1 text-xs leading-relaxed text-[#74695D]">
                  Tell us a little about what you're looking for.
                  We'll be happy to assist.
                </p>

                <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                  <input
                    type="text"
                    name="guestName"
                    value={form.guestName}
                    onChange={handleChange}
                    placeholder="Your name"
                    minLength={2}
                    maxLength={100}
                    required
                    className="w-full border border-[#D8CFC1] bg-white/60 px-4 py-3 text-sm outline-none transition placeholder:text-[#948779] focus:border-[#A65D45]"
                  />

                  <input
                    type="email"
                    name="guestEmail"
                    value={form.guestEmail}
                    onChange={handleChange}
                    placeholder="Email address"
                    required
                    className="w-full border border-[#D8CFC1] bg-white/60 px-4 py-3 text-sm outline-none transition placeholder:text-[#948779] focus:border-[#A65D45]"
                  />

                  <input
                    type="tel"
                    name="guestPhone"
                    value={form.guestPhone}
                    onChange={handleChange}
                    placeholder="Phone number (optional)"
                    minLength={7}
                    maxLength={20}
                    className="w-full border border-[#D8CFC1] bg-white/60 px-4 py-3 text-sm outline-none transition placeholder:text-[#948779] focus:border-[#A65D45]"
                  />

                  <textarea
                    name="content"
                    value={form.content}
                    onChange={handleChange}
                    placeholder="Your message..."
                    minLength={5}
                    maxLength={5000}
                    rows={4}
                    required
                    className="w-full resize-none border border-[#D8CFC1] bg-white/60 px-4 py-3 text-sm outline-none transition placeholder:text-[#948779] focus:border-[#A65D45]"
                  />

                  {error && (
                    <p role="alert" className="text-xs text-red-700">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#382F27] px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-[#F5F2EA] transition hover:bg-[#241C17] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "SENDING..." : "SEND ENQUIRY"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      {!isEventOpen && (
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close enquiry" : "Open enquiry"}
          className="flex items-center gap-3 rounded-full border border-[#F5F2EA]/40 bg-[#382F27] px-6 py-4 text-[#F5F2EA] shadow-xl transition hover:bg-[#241C17]"
        >
          <MessageCircle size={19} strokeWidth={1.6} />

          <span className="text-[10px] font-semibold tracking-[0.16em]">
            {isOpen ? "CLOSE" : "ENQUIRE NOW"}
          </span>
        </button>
      )}
    </div>
  );
}
