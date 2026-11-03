"use client";

import type { ReactNode } from "react";
import { UNITS, type Unit } from "@/lib/types";

/** Segmented control (single choice). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-2xl bg-seg p-1 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-10 min-w-0 flex-1 truncate rounded-xl px-2 text-sm font-semibold transition sm:px-3 ${
              on ? "bg-seg-on text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select chips for the counter format (years / months / weeks / days). */
export function UnitChips({ value, onChange }: { value: Unit[]; onChange: (v: Unit[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Counter format">
      {UNITS.map((u) => {
        const on = value.includes(u);
        return (
          <button
            key={u}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on ? value.filter((x) => x !== u) : UNITS.filter((x) => x === u || value.includes(x));
              onChange(next.length ? next : [u]);
            }}
            className={`h-10 rounded-full border px-4 text-sm font-semibold capitalize transition ${
              on ? "border-accent bg-accent text-on-accent" : "border-line bg-card text-ink hover:bg-seg"
            }`}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3.5 text-[15px] text-ink placeholder:text-muted/80 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export const buttonClass = {
  primary: "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60",
  secondary:
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-5 font-semibold text-ink hover:bg-seg disabled:opacity-60",
  danger:
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-card px-5 font-semibold text-danger hover:bg-danger/10",
};
