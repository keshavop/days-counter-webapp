"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/api";
import { AuthError, AuthScreen, PasswordInput, nextPath } from "@/components/AuthScreen";
import { Field, buttonClass, inputClass } from "@/components/Controls";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      // A full load, so the app starts fresh with this account's data.
      location.replace(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      panel={
        <>
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg p-6">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Next up · Trip to Lisbon</span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[64px] font-bold leading-none tracking-tight">42</span>
              <span className="text-xl text-muted">days to go</span>
            </div>
          </div>
          <p className="max-w-md text-[17px] leading-relaxed text-muted">Countdowns to the days that matter, count-ups from the ones that changed you.</p>
        </>
      }
      footer="Saved to a CSV file in your Google Drive."
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold tracking-tight">Welcome back</h1>
          <p className="text-[15px] text-muted">Log in to see your countdowns.</p>
        </div>
        {error && <AuthError>{error}</AuthError>}
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} invalid={Boolean(error)} />
        </Field>
        <button type="submit" className={buttonClass.primary} disabled={busy || !email.trim() || !password}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-accent-text hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
