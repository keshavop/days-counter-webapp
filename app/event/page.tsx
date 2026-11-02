"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { breakdown, countdown, formatDateTime, formatLong, today } from "@/lib/dates";
import { CounterCard } from "@/components/CounterCard";
import { NotFound } from "@/components/NotFound";
import { buttonClass } from "@/components/Controls";
import { IconBack, IconBell, IconCloudCheck, IconEdit, IconRefresh, IconRepeat, IconShare, IconTrash } from "@/components/Icons";

function EventDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { ready, getEvent, deleteEvent, pendingCount, status } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [shared, setShared] = useState("");

  if (!ready) return null;
  const ev = getEvent(id);
  if (!ev) return <NotFound />;
  const c = countdown(ev.date, ev.repeat, ev.format);
  const now = today();

  const stats = c
    ? [
        { value: formatLong(breakdown(now, c.target, ["years", "months", "days"])), label: "years · months · days" },
        { value: formatLong(breakdown(now, c.target, ["weeks", "days"])), label: "weeks · days" },
        { value: (Math.abs(c.days) * 24).toLocaleString(), label: "hours" },
      ]
    : [];

  const share = async () => {
    const text = c ? `${c.num} ${c.caption} — ${ev.title}` : ev.title;
    try {
      if (navigator.share) await navigator.share({ title: ev.title, text });
      else {
        await navigator.clipboard.writeText(text);
        setShared("Copied to clipboard");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl md:px-10 md:pt-8">
      <div className="relative">
        <CounterCard event={ev} className="min-h-[360px] w-full rounded-b-[28px] pb-8 pt-20 md:min-h-[420px] md:rounded-[28px]" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4" style={{ color: ev.color }}>
          <Link href="/" aria-label="Back to events" className="flex size-11 items-center justify-center rounded-full bg-black/20 backdrop-blur hover:bg-black/30">
            <IconBack />
          </Link>
          <div className="flex gap-2">
            <button type="button" onClick={share} aria-label="Share" className="flex size-11 items-center justify-center rounded-full bg-black/20 backdrop-blur hover:bg-black/30">
              <IconShare />
            </button>
            <Link
              href={`/edit?id=${encodeURIComponent(ev.id)}`}
              aria-label="Edit event"
              className="flex size-11 items-center justify-center rounded-full bg-black/20 backdrop-blur hover:bg-black/30"
            >
              <IconEdit />
            </Link>
          </div>
        </div>
      </div>
      {shared && (
        <p role="status" className="px-5 pt-3 text-center text-sm text-muted">
          {shared}
        </p>
      )}

      <div className="flex flex-col gap-4 px-5 pb-10 pt-5 md:px-0">
        {stats.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-card p-4">
                <div className="font-display text-xl font-bold leading-tight">{s.value}</div>
                <div className="mt-1 text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {ev.description && (
          <section className="rounded-3xl border border-line bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Notes</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{ev.description}</p>
          </section>
        )}

        <ul className="divide-y divide-line rounded-3xl border border-line bg-card px-5">
          <li className="flex items-center gap-3 py-3.5">
            <IconBell className="shrink-0 text-muted" />
            {ev.reminder_at ? (
              <div className="min-w-0">
                <div className="text-[15px] font-medium">{formatDateTime(ev.reminder_at)}</div>
                {ev.notify_text && <div className="truncate text-[13px] text-muted">“{ev.notify_text}”</div>}
              </div>
            ) : (
              <span className="text-[15px] text-muted">No reminder</span>
            )}
          </li>
          <li className="flex items-center gap-3 py-3.5">
            <IconRepeat className="shrink-0 text-muted" />
            <span className="text-[15px] font-medium">{ev.repeat === "once" ? "Only once" : `Repeats ${ev.repeat}`}</span>
          </li>
          <li className="flex items-center gap-3 py-3.5">
            {pendingCount > 0 || status === "unconfigured" ? (
              <IconRefresh className="shrink-0 text-warn" />
            ) : (
              <IconCloudCheck className="shrink-0 text-ok" />
            )}
            <span className="flex-1 text-[15px] font-medium">
              {status === "unconfigured" ? "Saved on this device" : pendingCount > 0 ? "Waiting to sync" : "Saved to Google Sheet"}
            </span>
            {status === "unconfigured" && (
              <Link href="/sync" className="text-sm font-semibold text-accent-text hover:underline">
                Connect
              </Link>
            )}
          </li>
        </ul>

        {confirming ? (
          <div role="alertdialog" aria-labelledby="del-title" className="rounded-3xl border border-danger/40 bg-card p-5">
            <p id="del-title" className="font-semibold">
              Delete “{ev.title}”?
            </p>
            <p className="mt-1 text-sm text-muted">It will also be removed from your Google Sheet.</p>
            <div className="mt-4 flex gap-3">
              <button type="button" className={`${buttonClass.secondary} flex-1`} onClick={() => setConfirming(false)}>
                Keep it
              </button>
              <button
                type="button"
                className={`${buttonClass.primary} flex-1 bg-danger hover:bg-danger/90`}
                onClick={() => {
                  deleteEvent(ev.id);
                  router.replace("/");
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={buttonClass.danger} onClick={() => setConfirming(true)}>
            <IconTrash size={18} /> Delete event
          </button>
        )}
      </div>
    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense>
      <EventDetail />
    </Suspense>
  );
}
