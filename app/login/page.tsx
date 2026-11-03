"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/api";
import { AuthError, AuthScreen, PasswordInput, nextPath, rememberLogin } from "@/components/AuthScreen";
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
      const user = await login(email.trim(), password);
      await rememberLogin(email.trim(), password, user.name);
      // A full load, so the app starts fresh with this account's data.
      location.replace(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      headline={
        <>
          All your days, <span className="text-accent-text">one place.</span>
        </>
      }
      footer="Saved to a CSV file in your Google Drive."
    >
      <form method="post" action="/login" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold tracking-tight">Welcome back</h1>
          <p className="text-[15px] text-muted">Log in to see your countdowns.</p>
        </div>
        {error && <AuthError>{error}</AuthError>}
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
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
