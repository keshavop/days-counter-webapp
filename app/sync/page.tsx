"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { eventsFromCSV, toCSV } from "@/lib/serialize";
import { relativeTime } from "@/lib/dates";
import { requestNotifications } from "@/lib/reminders";
import { COLUMNS, type Settings } from "@/lib/types";
import { Section, Segmented, buttonClass } from "@/components/Controls";
import { LogoutIcon } from "@/components/AppShell";
import { IconAlert, IconBell, IconCloud, IconCloudCheck, IconCloudOff, IconDownload, IconPhone, IconRefresh, IconUpload } from "@/components/Icons";

export default function SyncPage() {
  const store = useStore();
  const { settings, updateSettings, status, error, lastSync, pendingCount, events, syncNow, importEvents, canInstall, install, ready, user, logout } = store;

  const [importMsg, setImportMsg] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [notif, setNotif] = useState<string>("default");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    setNotif(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, [ready]);

  const exportCsv = () => {
    const blob = new Blob([toCSV(events)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `days-counter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    setImportMsg("");
    try {
      const { events: incoming, skipped } = eventsFromCSV(await file.text());
      if (!incoming.length) {
        setImportMsg("No events found. The file needs at least a title and date column.");
        return;
      }
      if (mode === "replace" && !confirm(`Replace all ${events.length} events with ${incoming.length} from the file?`)) return;
      await importEvents(incoming, mode);
      setImportMsg(`Imported ${incoming.length} event${incoming.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} without a valid date` : ""}.`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const statusView = {
    signedout: { icon: <IconCloud className="text-muted" />, title: "Signed out", text: "Log in to sync your events." },
    idle: {
      icon: <IconCloudCheck className="text-ok" />,
      title: pendingCount ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting` : "Saved to CSV in Google Drive",
      text: `Last synced ${relativeTime(lastSync)}`,
    },
    syncing: { icon: <IconRefresh className="animate-spin text-accent-text" />, title: "Syncing…", text: "Writing to events.csv in Google Drive" },
    offline: {
      icon: <IconCloudOff className="text-warn" />,
      title: "Offline",
      text: pendingCount ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you're back online` : "Changes will sync when you're back online",
    },
    error: { icon: <IconAlert className="text-danger" />, title: "Sync failed", text: error || "Something went wrong" },
  }[status];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-6 md:px-10 md:pt-10">
      <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Sync &amp; data</h1>
      <p className="mt-1 text-[15px] text-muted">Every change is saved on this device right away and written to events.csv in Google Drive about a second later.</p>

      <div className="mt-6 grid gap-4 pb-10 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-3xl border border-line bg-card p-5" aria-live="polite">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-seg">{statusView.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{statusView.title}</div>
                <div className="text-sm text-muted">{statusView.text}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-seg px-3 py-1 font-medium">{events.length} events</span>
              <span className="rounded-full bg-seg px-3 py-1 font-medium">{pendingCount} pending</span>
            </div>
            <button type="button" className={`${buttonClass.secondary} mt-4 w-full`} disabled={status === "syncing" || !user} onClick={() => void syncNow()}>
              <IconRefresh size={18} /> Sync now
            </button>
            <label className="mt-4 flex items-center gap-3 text-[15px]">
              <input type="checkbox" className="size-5" checked={settings.autoSync} onChange={(e) => updateSettings({ autoSync: e.target.checked })} />
              Sync automatically after every change
            </label>
          </section>

          <Section title="CSV backup">
            <p className="text-[15px] text-muted">Download every event as a CSV, or load one in. Columns match events.csv.</p>
            <button type="button" className={buttonClass.primary} onClick={exportCsv} disabled={!events.length}>
              <IconDownload size={18} /> Export CSV
            </button>
            <Segmented
              label="Import mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "merge", label: "Merge" },
                { value: "replace", label: "Replace all" },
              ]}
            />
            <button type="button" className={buttonClass.secondary} onClick={() => fileRef.current?.click()}>
              <IconUpload size={18} /> Import CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} onChange={(e) => importCsv(e.target.files?.[0])} />
            {importMsg && (
              <p role="status" className="text-sm font-medium">
                {importMsg}
              </p>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title="CSV columns">
            <div className="overflow-x-auto rounded-xl border border-line">
              <div className="flex w-max font-mono text-xs">
                {COLUMNS.map((c) => (
                  <span key={c} className="border-r border-line bg-bg px-2.5 py-2 last:border-r-0">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-muted">events.csv in Google Drive has these columns, plus a user_id column for each account.</p>
          </Section>

          {user && (
            <Section title="Account">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{user.name}</div>
                  <div className="truncate text-sm text-muted">Signed in as {user.email}</div>
                </div>
                <button type="button" className={buttonClass.secondary} onClick={() => void logout()}>
                  <LogoutIcon /> Log out
                </button>
              </div>
            </Section>
          )}

          <Section title="App">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Theme</span>
              <Segmented<Settings["theme"]>
                label="Theme"
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={notif === "granted" || notif === "unsupported"}
              onClick={async () => setNotif(await requestNotifications())}
            >
              <IconBell size={18} />
              {notif === "granted" ? "Reminders are on" : notif === "denied" ? "Notifications blocked in browser settings" : notif === "unsupported" ? "Notifications not supported" : "Allow reminder notifications"}
            </button>
            {canInstall ? (
              <button type="button" className={buttonClass.primary} onClick={install}>
                <IconPhone size={18} /> Install app
              </button>
            ) : (
              <p className="text-[13px] text-muted">
                To install: use your browser&apos;s <b>Install app</b> or <b>Add to Home Screen</b> option (on iPhone: Share → Add to Home Screen).
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
