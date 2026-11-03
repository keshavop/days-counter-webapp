"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { ping, SheetError } from "@/lib/sheets";
import { eventsFromCSV, toCSV } from "@/lib/serialize";
import { relativeTime } from "@/lib/dates";
import { requestNotifications } from "@/lib/reminders";
import { COLUMNS, type Settings } from "@/lib/types";
import { Field, Section, Segmented, buttonClass, inputClass } from "@/components/Controls";
import { IconAlert, IconBell, IconCloud, IconCloudCheck, IconCloudOff, IconCopy, IconDownload, IconPhone, IconRefresh, IconSheet, IconUpload } from "@/components/Icons";

export default function SyncPage() {
  const store = useStore();
  const { settings, updateSettings, status, error, lastSync, pendingCount, events, syncNow, importEvents, canInstall, install, ready } = store;

  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [copied, setCopied] = useState(false);
  const [notif, setNotif] = useState<string>("default");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    setUrl(settings.scriptUrl);
    setKey(settings.apiKey);
    setNotif(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    // Only seed the form once the saved settings have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const connect = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const info = await ping(url.trim(), key.trim());
      updateSettings({ scriptUrl: url.trim(), apiKey: key.trim(), sheetUrl: info.sheetUrl });
      setTestMsg({ ok: true, text: `Connected to “${info.sheetName || "your sheet"}”.` });
      setTimeout(() => void syncNow(), 50);
    } catch (err) {
      setTestMsg({ ok: false, text: err instanceof SheetError || err instanceof Error ? err.message : "Couldn't reach the script." });
    } finally {
      setTesting(false);
    }
  };

  const disconnect = () => {
    updateSettings({ scriptUrl: "", apiKey: "", sheetUrl: "" });
    setUrl("");
    setKey("");
    setTestMsg(null);
  };

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

  const copyScript = async () => {
    const code = await fetch("/apps-script/Code.gs").then((r) => r.text());
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connected = Boolean(settings.scriptUrl);
  const statusView = {
    unconfigured: { icon: <IconCloud className="text-muted" />, title: "Not connected", text: "Events are saved on this device only." },
    idle: {
      icon: <IconCloudCheck className="text-ok" />,
      title: pendingCount ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting` : "All synced",
      text: `Last synced ${relativeTime(lastSync)}`,
    },
    syncing: { icon: <IconRefresh className="animate-spin text-accent-text" />, title: "Syncing…", text: "Talking to your Google Sheet" },
    offline: {
      icon: <IconCloudOff className="text-warn" />,
      title: "Offline",
      text: pendingCount ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you're back online` : "Changes will sync when you're back online",
    },
    error: { icon: <IconAlert className="text-danger" />, title: "Sync failed", text: error || "Something went wrong" },
  }[status];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-5 md:px-10 md:pt-10">
      <h1 className="font-display text-[28px] font-bold tracking-tight md:text-4xl">Sync &amp; data</h1>
      <p className="mt-1 text-[15px] text-muted">Your events live in your own Google Sheet, through a small Apps Script.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 pb-10 lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <section className="order-[-2] min-w-0 rounded-3xl border border-line bg-card p-5 lg:order-none" aria-live="polite">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-seg">{statusView.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{statusView.title}</div>
                <div className="break-words text-sm text-muted">{statusView.text}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-seg px-3 py-1 font-medium">{events.length} {events.length === 1 ? "event" : "events"}</span>
              <span className="rounded-full bg-seg px-3 py-1 font-medium">{pendingCount} pending</span>
            </div>
            {connected && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={`${buttonClass.primary} flex-1 basis-40`} disabled={status === "syncing"} onClick={() => void syncNow()}>
                  <IconRefresh size={18} /> Sync now
                </button>
                {settings.sheetUrl && (
                  <a href={settings.sheetUrl} target="_blank" rel="noreferrer" className={`${buttonClass.secondary} flex-1 basis-40`}>
                    <IconSheet size={18} /> Open sheet
                  </a>
                )}
              </div>
            )}
          </section>

          <Section title="Google Sheet connection" className="min-w-0">
            <Field label="Apps Script web app URL" htmlFor="script-url">
              <input
                id="script-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
                placeholder="https://script.google.com/macros/s/…/exec"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>
            <Field label="Access key" htmlFor="api-key" hint="The API_KEY script property you set. Leave empty if you didn't set one.">
              <input id="api-key" type="password" autoComplete="off" className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} />
            </Field>
            {testMsg && <p className={`break-words text-sm font-medium ${testMsg.ok ? "text-ok" : "text-danger"}`}>{testMsg.text}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${buttonClass.primary} flex-1 basis-40`} disabled={!url.trim() || testing} onClick={connect}>
                {testing ? "Connecting…" : connected ? "Save & test" : "Connect"}
              </button>
              {connected && (
                <button type="button" className={`${buttonClass.secondary} flex-1 basis-32 sm:flex-none`} onClick={disconnect}>
                  Disconnect
                </button>
              )}
            </div>
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" className="size-5 shrink-0" checked={settings.autoSync} onChange={(e) => updateSettings({ autoSync: e.target.checked })} />
              Sync automatically after every change
            </label>
          </Section>

          <Section title="CSV backup" className="min-w-0">
            <p className="text-[15px] text-muted">Download every event as a CSV, or load one in. Columns match the sheet.</p>
            <button type="button" className={buttonClass.secondary} onClick={exportCsv} disabled={!events.length}>
              <IconDownload size={18} /> Export CSV
            </button>
            <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
              <span className="text-sm font-medium">Import a CSV file</span>
              <Segmented
                label="Import mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "merge", label: "Merge" },
                  { value: "replace", label: "Replace all" },
                ]}
              />
              <p className="text-[13px] text-muted">
                {mode === "merge" ? "Adds new events and updates ones with the same id." : "Deletes every event that isn't in the file."}
              </p>
              <button type="button" className={buttonClass.secondary} onClick={() => fileRef.current?.click()}>
                <IconUpload size={18} /> Choose CSV file
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} onChange={(e) => importCsv(e.target.files?.[0])} />
            {importMsg && (
              <p role="status" className="break-words text-sm font-medium">
                {importMsg}
              </p>
            )}
          </Section>
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <Section title="Set up in 5 minutes" className={`min-w-0 lg:order-none ${connected ? "" : "order-[-1]"}`}>
            <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[15px] leading-relaxed marker:font-semibold marker:text-muted">
              <li>Create a new Google Sheet (any name).</li>
              <li>
                Open <b>Extensions → Apps Script</b>, delete the sample code and paste the Days Counter script.
              </li>
              <li>
                Optional but recommended: <b>Project settings → Script properties</b>, add <code className="rounded bg-seg px-1">API_KEY</code> with a secret of
                your choice.
              </li>
              <li>
                <b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, who has access <b>Anyone</b>. Authorise it.
              </li>
              <li>Copy the web app URL ending in /exec, paste it here and press Connect.</li>
            </ol>
            <button type="button" className={buttonClass.secondary} onClick={copyScript}>
              <IconCopy size={18} /> {copied ? "Copied!" : "Copy Apps Script code"}
            </button>
          </Section>

          <Section title="Sheet columns" className="min-w-0">
            <ul className="flex flex-wrap gap-1.5" aria-label="Sheet columns">
              {COLUMNS.map((c) => (
                <li key={c} className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs">
                  {c}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-muted">The script creates an “events” tab with these headers. Edit rows in the sheet and they sync back here.</p>
          </Section>

          <Section title="App" className="min-w-0">
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
              className={`${buttonClass.secondary} h-auto min-h-12 py-3 text-center`}
              disabled={notif === "granted" || notif === "unsupported"}
              onClick={async () => setNotif(await requestNotifications())}
            >
              <IconBell size={18} className="shrink-0" />
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
