"use client";

import { useState, type ReactNode } from "react";
import { COVERS } from "@/lib/types";
import { inputClass } from "./Controls";

const cover = (name: string) => COVERS.find((c) => c.name === name)!.hex;

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-base font-bold text-on-accent">D</span>
      <span className="text-lg font-semibold tracking-tight">Days Counter</span>
    </div>
  );
}

/** One sample countdown card, in an event cover colour like the real cards. */
function StackCard({
  bg,
  tag,
  next,
  value,
  label,
  className,
}: {
  bg: string;
  tag: string;
  next?: boolean;
  value: string;
  label: string;
  className: string;
}) {
  return (
    <div className={`absolute flex flex-col justify-between rounded-[18px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.45)] ${className}`} style={{ background: bg }}>
      {next ? (
        <>
          <span className="self-start rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-on-accent lg:text-xs">{tag}</span>
          <div className="flex flex-col gap-1">
            <span className="font-bold leading-none tracking-tight">{value}</span>
            <span className="text-[13px] font-medium lg:text-[17px]">{label}</span>
          </div>
        </>
      ) : (
        // Cards behind the front one show only their top edge, so the number goes there.
        <>
          <div className="flex items-start justify-between gap-3">
            <span className="font-bold leading-none tracking-tight">{value}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/80 lg:text-xs">{tag}</span>
          </div>
          <span className="text-[13px] font-medium lg:text-[17px]">{label}</span>
        </>
      )}
    </div>
  );
}

/**
 * Three fanned-out sample countdowns: the shared cover of the log in and sign up pages.
 * Sized for the desktop side panel; `compact` is the strip shown above the form on phones.
 */
function CountdownStack({ compact = false }: { compact?: boolean }) {
  if (compact) {
    // Too narrow for three readable cards: the back two are just coloured edges.
    return (
      <div aria-hidden="true" className="relative h-[136px] w-full max-w-[340px]">
        <div className="absolute left-[150px] top-0 h-[104px] w-[170px] rotate-[7deg] rounded-[16px]" style={{ background: cover("Ember") }} />
        <div className="absolute left-[100px] top-[10px] h-[104px] w-[170px] -rotate-[4deg] rounded-[16px]" style={{ background: cover("Plum") }} />
        <StackCard
          bg={cover("Ocean")}
          tag="Next up"
          next
          value="42 days"
          label="Trip to Lisbon"
          className="left-0 top-[20px] h-[116px] w-[220px] p-3.5 [&_span.font-bold]:text-[30px]"
        />
      </div>
    );
  }
  const back = "h-[190px] w-[300px] p-5 [&_span.font-bold]:text-[36px]";
  return (
    <div aria-hidden="true" className="relative h-[380px] w-[460px]">
      <StackCard bg={cover("Ember")} tag="Since" value="1,204 days" label="Since we met" className={`${back} left-[150px] top-0 rotate-[7deg]`} />
      <StackCard bg={cover("Plum")} tag="Yearly" value="118 days" label="Mum’s birthday" className={`${back} left-[70px] top-[70px] -rotate-[4deg]`} />
      <StackCard
        bg={cover("Ocean")}
        tag="Next up"
        next
        value="42 days"
        label="Trip to Lisbon"
        className="left-0 top-[150px] h-[210px] w-[340px] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.5)] [&_span.font-bold]:text-[56px]"
      />
    </div>
  );
}

/** Log in / sign up layout: the countdown-stack cover beside the form on desktop, above it on a phone. */
export function AuthScreen({ headline, footer, children }: { headline: ReactNode; footer: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <section className="hidden flex-1 flex-col justify-between overflow-hidden border-r border-line bg-card px-14 py-12 lg:flex">
        <Logo />
        <CountdownStack />
        <div className="flex flex-col gap-2">
          <h2 className="text-[30px] font-bold leading-tight tracking-tight">{headline}</h2>
          <p className="text-sm text-muted">{footer}</p>
        </div>
      </section>
      <section className="flex min-w-0 flex-1 flex-col gap-6 overflow-hidden px-5 pb-8 pt-12 lg:items-center lg:justify-center lg:p-12">
        <div className="flex flex-col gap-6 lg:hidden">
          <Logo />
          <CountdownStack compact />
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
  name = "password",
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  name?: string;
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
        name={name}
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

interface PasswordCredentialCtor {
  new (data: { id: string; password: string; name?: string }): Credential;
}

/**
 * Ask the browser's password manager to save this login (Chromium's Credential Management API).
 * Safari and Firefox offer to save from the form itself once the page navigates away.
 */
export async function rememberLogin(email: string, password: string, name?: string): Promise<void> {
  const Ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential;
  if (!Ctor || !navigator.credentials?.store) return;
  try {
    // Never hold up the redirect for long if the browser is slow to answer.
    await Promise.race([navigator.credentials.store(new Ctor({ id: email, password, name })), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* the user dismissed it, or the browser refused: signing in still worked */
  }
}

/** Where to go after signing in: the ?next= page if it's one of ours, else home. */
export function nextPath(): string {
  const next = new URLSearchParams(location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
