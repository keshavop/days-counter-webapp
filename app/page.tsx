"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { countdown, formatDate, today, type Countdown } from "@/lib/dates";
import type { DayEvent } from "@/lib/types";
import { Segmented } from "@/components/Controls";
import { SyncPill } from "@/components/SyncPill";
import { IconChevron, IconPlus, IconRepeat, IconSearch } from "@/components/Icons";

type Item = { e: DayEvent; c: Countdown };
type Sort = "soonest" | "latest" | "title";

export default function EventsPage() {
  const { events, ready } = useStore();
  const [tab, setTab] = useState<"up" | "past">("up");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("soonest");

  const { upcoming, past } = useMemo(() => {
    const now = today();
    const items: Item[] = [];
    for (const e of events) {
      const c = countdown(e.date, e.repeat, e.format, now);
      if (c) items.push({ e, c });
    }
    return {
      upcoming: items.filter((i) => !i.c.isPast).sort((a, b) => a.c.days - b.c.days),
      past: items.filter((i) => i.c.isPast).sort((a, b) => b.c.days - a.c.days),
    };
  }, [events]);

  const base = tab === "up" ? upcoming : past;
  const q = query.trim().toLowerCase();
  const filtered = base.filter((i) => !q || i.e.title.toLowerCase().includes(q) || i.e.description.toLowerCase().includes(q));
  const sorted =
    sort === "title"
      ? [...filtered].sort((a, b) => a.e.title.localeCompare(b.e.title))
      : sort === "latest"
        ? [...filtered].reverse()
        : filtered;
  const [hero, ...rest] = q || sort !== "soonest" ? [undefined, ...sorted] : sorted;

  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-6 md:px-10 md:pt-10">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted" suppressHydrationWarning>
            {dateLabel}
          </p>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight md:text-4xl">
            <span className="md:hidden">Days Counter</span>
            <span className="hidden md:inline">Your days</span>
          </h1>
        </div>
        <SyncPill className="md:hidden" />
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Event timeline"
          value={tab}
          onChange={setTab}
          className="w-full sm:w-80"
          options={[
            { value: "up", label: `Upcoming · ${upcoming.length}` },
            { value: "past", label: `Since · ${past.length}` },
          ]}
        />
        <div className="relative min-w-0 flex-1 basis-56">
          <IconSearch size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="search" className="sr-only">
            Search events
          </label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events"
            className="h-12 w-full rounded-2xl border border-line bg-card pl-10 pr-4 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <label htmlFor="sort" className="sr-only">
          Sort
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-12 rounded-2xl border border-line bg-card px-3 text-sm font-medium outline-none focus:border-accent"
        >
          <option value="soonest">{tab === "up" ? "Soonest first" : "Longest ago first"}</option>
          <option value="latest">{tab === "up" ? "Furthest first" : "Most recent first"}</option>
          <option value="title">A–Z</option>
        </select>
      </div>

      {!ready ? (
        <div className="mt-6 grid gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-seg" />
          ))}
        </div>
      ) : base.length === 0 ? (
        <EmptyState tab={tab} />
      ) : sorted.length === 0 ? (
        <p className="mt-10 text-center text-muted">No events match “{query}”.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4 md:gap-6">
          {hero && <Hero item={hero} kicker={tab === "up" ? "Next up" : "Longest running"} />}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
            {rest.map((i) => i && <Row key={i.e.id} item={i} />)}
          </ul>
        </div>
      )}

      <Link
        href="/new"
        className="fixed bottom-24 right-5 z-20 flex h-14 items-center gap-2 rounded-full bg-accent pl-4 pr-5 font-semibold text-white shadow-[0_8px_24px_rgba(194,65,12,0.35)] hover:bg-accent-hover md:hidden"
      >
        <IconPlus size={20} strokeWidth={2.4} /> New event
      </Link>
    </div>
  );
}

function progress(e: DayEvent, c: Countdown): number {
  // How far along we are from when the event was created to the target date.
  const start = new Date(e.created_at).getTime();
  const end = c.target.getTime();
  if (!Number.isFinite(start) || end <= start) return 100;
  return Math.max(4, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
}

function Hero({ item: { e, c }, kicker }: { item: Item; kicker: string }) {
  return (
    <Link
      href={`/event?id=${encodeURIComponent(e.id)}`}
      className="relative isolate block overflow-hidden rounded-[28px] p-6 md:p-8"
      style={{ backgroundColor: e.cover, color: e.color }}
    >
      {e.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.image} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black" style={{ opacity: e.dim / 100 }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] opacity-90">{kicker}</span>
        {e.repeat !== "once" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium capitalize">
            <IconRepeat size={14} /> {e.repeat}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-7xl font-bold leading-[0.9] tracking-tight md:text-8xl">{c.num}</span>
        <span className="text-lg font-medium">{c.caption}</span>
      </div>
      <div className="mt-3 text-lg font-semibold md:text-xl">{e.title}</div>
      <div className="mt-0.5 text-sm opacity-90">
        {c.isPast ? "Since " : ""}
        {formatDate(c.target, true)}
      </div>
      {!c.isPast && (
        <div aria-hidden="true" className="mt-5 h-1.5 rounded-full bg-white/25">
          <div className="h-1.5 rounded-full bg-current" style={{ width: `${progress(e, c)}%` }} />
        </div>
      )}
    </Link>
  );
}

function Row({ item: { e, c } }: { item: Item }) {
  const multi = !c.unit && c.num !== "Today!";
  return (
    <li>
      <Link
        href={`/event?id=${encodeURIComponent(e.id)}`}
        className="flex items-center gap-3.5 rounded-[20px] border border-line bg-card p-2.5 pr-4 hover:border-muted/40"
      >
        <div
          className="relative isolate flex size-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl text-center"
          style={{ backgroundColor: e.cover, color: e.color }}
        >
          {e.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.image} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
          )}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black" style={{ opacity: Math.max(e.dim, e.image ? 35 : 0) / 100 }} />
          <span className={`font-display font-bold leading-none ${multi || c.num.length > 4 ? "text-sm" : "text-2xl"}`}>{c.num}</span>
          {c.unit && <span className="mt-0.5 text-[11px] font-semibold">{c.unit}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{e.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            {e.repeat !== "once" && <IconRepeat size={13} aria-label={`Repeats ${e.repeat}`} />}
            <span className="truncate">
              {c.isPast ? "Since " : ""}
              {formatDate(c.target)}
            </span>
          </div>
        </div>
        <IconChevron size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function EmptyState({ tab }: { tab: "up" | "past" }) {
  return (
    <div className="mt-8 flex flex-col items-center rounded-[28px] border border-dashed border-line bg-card px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft font-display text-2xl font-bold text-accent-soft-ink">0</div>
      <h2 className="mt-4 font-display text-xl font-bold">{tab === "up" ? "Nothing to count down to yet" : "Nothing counted up yet"}</h2>
      <p className="mt-1.5 max-w-sm text-[15px] text-muted">
        {tab === "up"
          ? "Add a trip, a birthday or a deadline and watch the days tick down."
          : "Pick a past date, like the day you started a habit, and see how far you've come."}
      </p>
      <Link href="/new" className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-hover">
        <IconPlus size={18} strokeWidth={2.4} /> New event
      </Link>
    </div>
  );
}
