"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signup } from "@/lib/api";
import { AuthError, AuthScreen, PasswordInput, nextPath } from "@/components/AuthScreen";
import { Field, buttonClass, inputClass } from "@/components/Controls";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Check() {
  return (
    <span aria-hidden="true" className="flex size-5 items-center justify-center rounded bg-accent-soft text-accent-soft-ink">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const errors = {
    name: name.trim() ? "" : "Enter your name.",
    email: EMAIL.test(email.trim()) ? "" : "Enter a full email address, like name@example.com.",
    confirm: confirm === password ? "" : "Passwords don’t match.",
  };
  const longEnough = password.length >= 8;
  const valid = !errors.name && !errors.email && !errors.confirm && longEnough;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await signup(name.trim(), email.trim(), password);
      location.replace(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the account. Try again.");
      setBusy(false);
    }
  };

  const show = (k: keyof typeof errors) => (tried ? errors[k] : "");

  return (
    <AuthScreen
      panel={
        <>
          <h2 className="max-w-md text-[42px] font-bold leading-[1.1] tracking-tight">
            Every day that matters, <span className="text-accent-text">in one place.</span>
          </h2>
          <ul className="flex flex-col gap-3 text-base">
            <li className="flex items-center gap-2.5">
              <Check /> Countdowns and count-ups with live progress
            </li>
            <li className="flex items-center gap-2.5">
              <Check /> Your data saved as CSV in Google Drive
            </li>
            <li className="flex items-center gap-2.5">
              <Check /> Works offline, syncs when you’re back
            </li>
          </ul>
        </>
      }
      footer="Already counting? Log in on any device to pick up where you left off."
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-semibold tracking-tight">Create your account</h1>
          <p className="text-[15px] text-muted">It takes a few seconds.</p>
        </div>
        {error && <AuthError>{error}</AuthError>}
        <Field label="Name" htmlFor="name" hint={show("name") && <span className="text-danger">{show("name")}</span>}>
          <input id="name" type="text" autoComplete="name" required className={`${inputClass} ${show("name") ? "border-danger" : ""}`} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email" hint={show("email") && <span id="email-err" className="text-danger">{show("email")}</span>}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(show("email")) || undefined}
            aria-describedby={show("email") ? "email-err" : undefined}
            className={`${inputClass} ${show("email") ? "border-danger" : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={
            <span id="pw-hint" className={`flex items-center gap-1.5 ${longEnough ? "text-ok" : tried ? "text-danger" : ""}`}>
              {longEnough && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
              At least 8 characters
            </span>
          }
        >
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} invalid={tried && !longEnough} describedBy="pw-hint" />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" hint={show("confirm") && <span id="confirm-err" className="text-danger">{show("confirm")}</span>}>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(show("confirm")) || undefined}
            aria-describedby={show("confirm") ? "confirm-err" : undefined}
            className={`${inputClass} ${show("confirm") ? "border-danger" : ""}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <button type="submit" className={buttonClass.primary} disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-text hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
