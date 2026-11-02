"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, breakdown, counterText, daysBetween, formatDate, formatLong, parseDate, toISODate, today, weekdaysBetween } from "@/lib/dates";
import type { Unit } from "@/lib/types";
import { Section, UnitChips, inputClass } from "@/components/Controls";
import { IconPlus, IconSwap } from "@/components/Icons";

export default function CalculatorPage() {
  const [start, setStart] = useState(() => toISODate(today()));
  const [end, setEnd] = useState(() => toISODate(addDays(today(), 30)));
  const [units, setUnits] = useState<Unit[]>(["days"]);
  const [inclusive, setInclusive] = useState(false);

  const a = parseDate(start);
  const b0 = parseDate(end);
  const b = b0 && inclusive ? addDays(b0, daysBetween(a ?? b0, b0) >= 0 ? 1 : -1) : b0;
  const ready = a && b;
  const total = ready ? Math.abs(daysBetween(a, b)) : 0;
  const main = ready ? counterText(breakdown(a, b, units)) : null;

  const rows = ready
    ? [
        { label: "Years, months, days", value: formatLong(breakdown(a, b, ["years", "months", "days"])) },
        { label: "Weeks and days", value: formatLong(breakdown(a, b, ["weeks", "days"])) },
        { label: "Total days", value: total.toLocaleString() },
        { label: "Weekdays (Mon–Fri)", value: weekdaysBetween(a, b).toLocaleString() },
        { label: "Hours", value: (total * 24).toLocaleString() },
      ]
    : [];

  const dateField = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} type="date" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          onClick={() => onChange(toISODate(today()))}
          className="h-12 shrink-0 rounded-xl border border-line bg-card px-3.5 text-sm font-semibold hover:bg-seg"
        >
          Today
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-6 md:px-10 md:pt-10">
      <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Date calculator</h1>
      <p className="mt-1 text-[15px] text-muted">How long between two dates?</p>

      <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Section title="Dates">
            {dateField("start", "From", start, setStart)}
            <button
              type="button"
              onClick={() => {
                setStart(end);
                setEnd(start);
              }}
              className="mx-auto -my-1 flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold hover:bg-seg"
            >
              <IconSwap size={16} /> Swap
            </button>
            {dateField("end", "To", end, setEnd)}
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" className="size-5" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} />
              Include the end date (+1 day)
            </label>
          </Section>
          <Section title="Show result in">
            <UnitChips value={units} onChange={setUnits} />
          </Section>
        </div>

        <div className="flex flex-col gap-4 md:w-[400px] md:shrink-0">
          <section aria-live="polite" className="rounded-[28px] bg-[#1e293b] p-6 text-white">
            {main && a && b ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/80">Result</div>
                <div className="mt-3 font-display text-6xl font-bold leading-none tracking-tight">{main.num}</div>
                {main.unit && <div className="mt-2 text-lg font-medium">{main.unit}</div>}
                <div className="mt-4 text-sm text-white/85">
                  {formatDate(a)} → {formatDate(b0 ?? b)}
                </div>
              </>
            ) : (
              <p className="text-white/85">Pick two dates.</p>
            )}
          </section>
          {rows.length > 0 && (
            <dl className="divide-y divide-line rounded-3xl border border-line bg-card px-5">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-muted">{r.label}</dt>
                  <dd className="text-right text-[15px] font-semibold">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {b0 && (
            <Link
              href={`/new?date=${encodeURIComponent(end)}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card font-semibold hover:bg-seg"
            >
              <IconPlus size={18} /> Save end date as an event
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
