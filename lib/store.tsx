"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DayEvent, Settings, SyncStatus } from "./types";
import { listEvents, pushEvents, replaceAll } from "./sheets";
import { checkReminders } from "./reminders";

const KEYS = {
  events: "dc.events",
  pending: "dc.pending",
  settings: "dc.settings",
  lastSync: "dc.lastSync",
} as const;

const DEFAULT_SETTINGS: Settings = {
  scriptUrl: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ?? "",
  apiKey: "",
  sheetUrl: "",
  autoSync: true,
  theme: "system",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app keeps working in memory */
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Store {
  ready: boolean;
  /** Live events (no tombstones). */
  events: DayEvent[];
  pendingCount: number;
  settings: Settings;
  status: SyncStatus;
  error: string;
  lastSync: string | null;
  canInstall: boolean;
  getEvent: (id: string) => DayEvent | undefined;
  saveEvent: (e: DayEvent) => void;
  deleteEvent: (id: string) => void;
  importEvents: (events: DayEvent[], mode: "merge" | "replace") => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  syncNow: () => Promise<void>;
  install: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [all, setAll] = useState<DayEvent[]>([]);
  const [pending, setPending] = useState<Record<string, string>>({}); // id → updated_at that still needs pushing
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // Refs mirror state so async sync code always sees the latest values.
  const allRef = useRef(all);
  const pendingRef = useRef(pending);
  const settingsRef = useRef(settings);
  const syncing = useRef(false);
  allRef.current = all;
  pendingRef.current = pending;
  settingsRef.current = settings;

  /* ---------- load + persist ---------- */
  useEffect(() => {
    setAll(load<DayEvent[]>(KEYS.events, []));
    setPending(load<Record<string, string>>(KEYS.pending, {}));
    setSettings({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(KEYS.settings, {}) });
    setLastSync(load<string | null>(KEYS.lastSync, null));
    setReady(true);
  }, []);

  useEffect(() => void (ready && save(KEYS.events, all)), [ready, all]);
  useEffect(() => void (ready && save(KEYS.pending, pending)), [ready, pending]);
  useEffect(() => void (ready && save(KEYS.settings, settings)), [ready, settings]);
  useEffect(() => void (ready && save(KEYS.lastSync, lastSync)), [ready, lastSync]);

  /* ---------- theme ---------- */
  useEffect(() => {
    if (!ready) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0f17" : "#f3f4f6");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [ready, settings.theme]);

  /* ---------- sync ---------- */
  const syncNow = useCallback(async () => {
    const { scriptUrl, apiKey } = settingsRef.current;
    if (!scriptUrl) {
      setStatus("unconfigured");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    if (syncing.current) return;
    syncing.current = true;
    setStatus("syncing");
    setError("");

    const sent = { ...pendingRef.current };
    const changed = allRef.current.filter((e) => sent[e.id] !== undefined);
    try {
      const remote = changed.length ? await pushEvents(scriptUrl, apiKey, changed) : await listEvents(scriptUrl, apiKey);
      // Anything edited while the request was in flight stays pending and keeps its local copy.
      const still: Record<string, string> = {};
      for (const [id, stamp] of Object.entries(pendingRef.current)) if (sent[id] !== stamp) still[id] = stamp;
      const local = allRef.current.filter((e) => still[e.id] !== undefined);
      const localIds = new Set(local.map((e) => e.id));
      setAll([...remote.filter((e) => !localIds.has(e.id)), ...local]);
      setPending(still);
      setLastSync(new Date().toISOString());
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(navigator.onLine ? "error" : "offline");
    } finally {
      syncing.current = false;
    }
  }, []);

  // Sync on start, when connectivity returns, and every 5 minutes.
  useEffect(() => {
    if (!ready) return;
    if (!settings.scriptUrl) {
      setStatus("unconfigured");
      return;
    }
    void syncNow();
    const onOnline = () => void syncNow();
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = window.setInterval(() => {
      if (settingsRef.current.autoSync && document.visibilityState === "visible") void syncNow();
    }, 5 * 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
    };
  }, [ready, settings.scriptUrl, syncNow]);

  // Push local changes shortly after they happen.
  const pendingCount = Object.keys(pending).length;
  useEffect(() => {
    if (!ready || !pendingCount || !settings.autoSync || !settings.scriptUrl) return;
    const t = window.setTimeout(() => void syncNow(), 1200);
    return () => window.clearTimeout(t);
  }, [ready, pending, pendingCount, settings.autoSync, settings.scriptUrl, syncNow]);

  /* ---------- reminders ---------- */
  useEffect(() => {
    if (!ready) return;
    const run = () => void checkReminders(allRef.current.filter((e) => !e.deleted));
    run();
    const t = window.setInterval(run, 60_000);
    return () => window.clearInterval(t);
  }, [ready, all]);

  /* ---------- install prompt ---------- */
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /* ---------- actions ---------- */
  const markPending = (list: DayEvent[]) =>
    setPending((p) => {
      const next = { ...p };
      for (const e of list) next[e.id] = e.updated_at;
      return next;
    });

  const saveEvent = useCallback((e: DayEvent) => {
    const stamped = { ...e, updated_at: new Date().toISOString() };
    setAll((prev) => {
      const i = prev.findIndex((x) => x.id === e.id);
      if (i === -1) return [...prev, stamped];
      const next = prev.slice();
      next[i] = stamped;
      return next;
    });
    markPending([stamped]);
  }, []);

  const deleteEvent = useCallback((id: string) => {
    const existing = allRef.current.find((e) => e.id === id);
    if (!existing) return;
    const tomb = { ...existing, deleted: true, updated_at: new Date().toISOString() };
    setAll((prev) => prev.map((e) => (e.id === id ? tomb : e)));
    markPending([tomb]);
  }, []);

  const importEvents = useCallback(
    async (incoming: DayEvent[], mode: "merge" | "replace") => {
      const now = new Date().toISOString();
      const stamped = incoming.map((e) => ({ ...e, updated_at: now }));
      const { scriptUrl, apiKey } = settingsRef.current;
      if (mode === "replace") {
        if (scriptUrl && navigator.onLine) {
          setStatus("syncing");
          try {
            const remote = await replaceAll(scriptUrl, apiKey, stamped);
            setAll(remote);
            setPending({});
            setLastSync(new Date().toISOString());
            setStatus("idle");
            return;
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
            throw err;
          }
        }
        // Offline / not connected: replace locally, delete the rest when we next sync.
        const keep = new Set(stamped.map((e) => e.id));
        const tombs = allRef.current.filter((e) => !keep.has(e.id)).map((e) => ({ ...e, deleted: true, updated_at: now }));
        setAll([...stamped, ...tombs]);
        markPending([...stamped, ...tombs]);
        return;
      }
      setAll((prev) => {
        const map = new Map(prev.map((e) => [e.id, e]));
        for (const e of stamped) map.set(e.id, e);
        return [...map.values()];
      });
      markPending(stamped);
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }, [installEvent]);

  const events = useMemo(() => all.filter((e) => !e.deleted), [all]);
  const getEvent = useCallback((id: string) => events.find((e) => e.id === id), [events]);

  const value: Store = {
    ready,
    events,
    pendingCount,
    settings,
    status,
    error,
    lastSync,
    canInstall: installEvent !== null,
    getEvent,
    saveEvent,
    deleteEvent,
    importEvents,
    updateSettings,
    syncNow,
    install,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
