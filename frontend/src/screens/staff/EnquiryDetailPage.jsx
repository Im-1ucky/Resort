
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Sparkles,
  RefreshCw,
  MessageSquare,
  StickyNote,
  Check,
  X,
  UserRound,
} from "lucide-react";
import { apiFetch } from "@/services/api";
import { useStaffAuth } from "@/contexts/StaffAuthProvider";

const statusLabels = {
  NEW: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_FOR_GUEST: "Awaiting guest",
  RESOLVED: "Solved",
  CLOSED: "Closed",
};

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EnquiryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = useStaffAuth();

  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const autoDraftStarted = useRef(false);

  const [mode, setMode] = useState("reply");
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState(null);

  const loadEnquiry = useCallback(async (generateIfMissing = false) => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/enquiries/${id}`);
      setEnquiry(data.enquiry);

      const pendingDraft = data.enquiry.replyDrafts?.find(
        (item) => item.status === "PENDING_REVIEW"
      );

      if (pendingDraft) {
        setDraft(pendingDraft);
        setContent(pendingDraft.content);
        setMode("reply");
      } else if (
        generateIfMissing &&
        !["RESOLVED", "CLOSED"].includes(data.enquiry.status) &&
        !autoDraftStarted.current
      ) {
        autoDraftStarted.current = true;

        try {
          const result = await apiFetch(`/enquiries/${id}/reply-drafts`, {
            method: "POST",
          });

          setDraft(result.draft);
          setContent(result.draft.content);
          setMode("reply");
        } catch (err) {
          setError(`Could not generate AI draft: ${err.message}`);
        }
      } else {
        setDraft(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const isResolved = enquiry &&
      ["RESOLVED", "CLOSED"].includes(enquiry.status);

    loadEnquiry(!isResolved);
  }, [id, loadEnquiry]);

  async function generateDraft() {
    setActionLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/enquiries/${id}/reply-drafts`, {
        method: "POST",
      });

      setDraft(data.draft);
      setContent(data.draft.content);
      setMode("reply");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function saveDraft() {
    if (!draft || !content.trim()) return;

    setActionLoading(true);
    setError("");

    try {
      const data = await apiFetch(
        `/enquiries/${id}/reply-drafts/${draft.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ content }),
        }
      );

      setDraft(data.draft);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setActionLoading(false);
    }
  }

  async function approveDraft() {
    if (!draft || !content.trim()) return;

    setActionLoading(true);
    setError("");

    try {
      await apiFetch(`/enquiries/${id}/reply-drafts/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });

      await apiFetch(
        `/enquiries/${id}/reply-drafts/${draft.id}/approve`,
        { method: "POST" }
      );

      setDraft(null);
      setContent("");
      await loadEnquiry();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectDraft() {
    if (!draft) return;

    setActionLoading(true);
    setError("");

    try {
      await apiFetch(
        `/enquiries/${id}/reply-drafts/${draft.id}/reject`,
        { method: "POST" }
      );

      setDraft(null);
      setContent("");
      await loadEnquiry();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleStatus() {
    const nextStatus =
      enquiry.status === "RESOLVED" || enquiry.status === "CLOSED"
        ? "IN_PROGRESS"
        : "RESOLVED";

    setActionLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/enquiries/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      setEnquiry((current) => ({
        ...current,
        status: data.enquiry.status,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();

    if (!content.trim()) return;

    setActionLoading(true);
    setError("");

    try {
      if (mode === "note") {
        await apiFetch(`/enquiries/${id}/notes`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
      } else {
        await apiFetch(`/enquiries/${id}/replies`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
      }

      setContent("");
      await loadEnquiry();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ivory text-sm text-stone-500">
        Loading conversation...
      </main>
    );
  }

  if (error && !enquiry) {
    return (
      <main className="min-h-screen bg-ivory p-8 text-coffee">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm"
        >
          <ArrowLeft size={17} /> Back
        </button>
        <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      </main>
    );
  }

  if (!enquiry) return null;

  return (
    <main className="flex min-h-screen flex-col bg-ivory text-coffee">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-[#dedbd2] px-5 py-5 sm:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <button
            onClick={() => router.push("/staff/dashboard")}
            aria-label="Back to enquiries"
            className="grid size-10 shrink-0 place-items-center rounded-full text-coffee transition hover:bg-white"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl text-forest sm:text-3xl">
              {enquiry.guestName}
            </h1>
            <p className="truncate text-xs text-stone-500">
              {enquiry.guestEmail || "No email provided"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs text-stone-500 sm:block">
            {enquiry.department}
          </span>
          <button
            onClick={toggleStatus}
            disabled={actionLoading}
            title="Click to change enquiry status"
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition hover:opacity-75 disabled:opacity-50 ${
              ["RESOLVED", "CLOSED"].includes(enquiry.status)
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {statusLabels[enquiry.status] || enquiry.status}
          </button>
          <button
            onClick={loadEnquiry}
            aria-label="Refresh conversation"
            className="grid size-10 place-items-center rounded-full bg-coffee text-white transition hover:bg-coffee-dark"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* Conversation */}
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8">

        <div className="flex flex-1 flex-col gap-5">
          {enquiry.messages?.length ? (
            enquiry.messages.map((message) => {
              const isStaff = message.senderType === "STAFF";

              return (
                <div
                  key={message.id}
                  className={`flex ${isStaff ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${
                      isStaff
                        ? "rounded-br-sm bg-forest text-white"
                        : "rounded-bl-sm border border-[#dedbd2] bg-white text-coffee"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[10px] opacity-70">
                      {isStaff ? (
                        <UserRound size={12} />
                      ) : (
                        <UserRound size={12} />
                      )}
                      <span>
                        {isStaff
                          ? message.senderUser?.name || "Staff"
                          : enquiry.guestName}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>

                    <p className="mt-2 text-right text-[10px] opacity-60">
                      {formatDate(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-12 text-center text-sm text-stone-500">
              No messages in this conversation yet.
            </p>
          )}
        </div>

        {/* Internal notes */}
        {enquiry.notes?.length > 0 && (
          <div className="mt-8 border-t border-[#dedbd2] pt-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-wood">
              <StickyNote size={15} />
              Internal notes · Staff only
            </div>

            <div className="flex flex-col gap-3">
              {enquiry.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <p className="whitespace-pre-wrap text-sm text-coffee">
                    {note.content}
                  </p>
                  <p className="mt-2 text-[10px] text-stone-500">
                    {note.author?.name || "Staff"} · {formatDate(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="mt-8 border-t border-[#dedbd2] pt-6">
          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("reply");
                  if (!draft) setContent("");
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  mode === "reply"
                    ? "bg-forest text-white"
                    : "border border-[#dedbd2] bg-white text-coffee"
                }`}
              >
                <MessageSquare size={14} />
                Reply
              </button>

              <button
                onClick={() => {
                  setMode("note");
                  setContent("");
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  mode === "note"
                    ? "bg-coffee text-white"
                    : "border border-[#dedbd2] bg-white text-coffee"
                }`}
              >
                <StickyNote size={14} />
                Internal note
              </button>
            </div>

            {mode === "reply" && (
              <button
                onClick={generateDraft}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-full border border-forest/20 bg-white px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest hover:text-white disabled:opacity-50"
              >
                <Sparkles size={14} />
                {actionLoading ? "Generating..." : "Generate AI draft"}
              </button>
            )}
          </div>

          {draft && mode === "reply" && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-forest/20 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-forest">
                <Sparkles size={15} />
                AI draft · Review before sending
              </div>
              <button
                onClick={rejectDraft}
                disabled={actionLoading}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-red-700"
              >
                <X size={14} />
                Discard
              </button>
            </div>
          )}

          <form onSubmit={submitMessage}>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                mode === "note"
                  ? "Write a private note for other staff..."
                  : "Write your reply to the guest..."
              }
              rows={5}
              maxLength={5000}
              className="w-full resize-y rounded-xl border border-[#dedbd2] bg-white p-4 text-sm leading-relaxed outline-none transition placeholder:text-stone-400 focus:border-forest"
            />

            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

              {draft && mode === "reply" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={actionLoading || !content.trim()}
                    className="rounded-full border border-coffee/20 bg-white px-4 py-2.5 text-xs font-semibold text-coffee transition hover:bg-cream disabled:opacity-50"
                  >
                    Save edits
                  </button>

                  <button
                    type="button"
                    onClick={approveDraft}
                    disabled={actionLoading || !content.trim()}
                    className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-dark disabled:opacity-50"
                  >
                    <Check size={15} />
                    {actionLoading ? "Processing..." : "Approve & mark sent"}
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={actionLoading || !content.trim()}
                  className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white transition disabled:opacity-50 ${
                    mode === "note"
                      ? "bg-coffee hover:bg-coffee-dark"
                      : "bg-forest hover:bg-forest-dark"
                  }`}
                >
                  {mode === "note" ? (
                    <StickyNote size={15} />
                  ) : (
                    <Send size={15} />
                  )}
                  {actionLoading
                    ? "Processing..."
                    : mode === "note"
                      ? "Save private note"
                      : "Send reply"}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
