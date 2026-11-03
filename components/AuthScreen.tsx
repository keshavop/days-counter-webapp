"use client";

import { useState, type ReactNode } from "react";
import { inputClass } from "./Controls";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-base font-bold text-on-accent">D</span>
      <span className="text-lg font-semibold tracking-tight">Days Counter</span>
    </div>
  );
}

/** Log in / sign up layout: a brand panel beside the form on desktop, the form alone on a phone. */
export function AuthScreen({ panel, footer, children }: { panel: ReactNode; footer: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <section className="hidden flex-1 flex-col justify-between border-r border-line bg-card p-12 lg:flex">
        <Logo />
        <div className="flex flex-col gap-5">{panel}</div>
        <p className="text-[13px] text-muted">{footer}</p>
      </section>
      <section className="flex flex-1 flex-col px-5 pb-8 pt-14 lg:items-center lg:justify-center lg:p-12">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-[380px]">{children}</div>
      </section>
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-3 text-sm leading-snug text-danger">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-px shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.5" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} pr-12 ${invalid ? "border-danger" : ""}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-0.5 top-0.5 flex size-11 items-center justify-center rounded-lg text-muted hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

/** Where to go after signing in: the ?next= page if it's one of ours, else home. */
export function nextPath(): string {
  const next = new URLSearchParams(location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
