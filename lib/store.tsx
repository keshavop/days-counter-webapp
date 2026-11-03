"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DayEvent, Settings, SyncStatus, User } from "./types";
import { AuthError, listEvents, logout as apiLogout, me, pushEvents, replaceAll } from "./api";
import { checkReminders } from "./reminders";

const SETTINGS_KEY = "dc.settings";
const USER_KEY = "dc.user";
/** Each account's data is kept apart, so a shared device never mixes them. */
const keys = (userId: string) =>
  ({
    events: `dc.${userId}.events`,
    pending: `dc.${userId}.pending`,
    lastSync: `dc.${userId}.lastSync`,
  }) as const;

const AUTH_PAGES = ["/login", "/signup"];

function toLogin() {
  if (AUTH_PAGES.includes(location.pathname)) return;
  const next = location.pathname + location.search;
  location.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
}

const DEFAULT_SETTINGS: Settings = {
  autoSync: true,
  theme: "dark",
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

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Store {
  ready: boolean;
  /** The signed-in account, or null on the login and signup pages. */
  user: User | null;
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
  logout: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
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
  const userRef = useRef(user);
  const syncing = useRef(false);
  allRef.current = all;
  pendingRef.current = pending;
  settingsRef.current = settings;
  userRef.current = user;

  /* ---------- load + persist ---------- */
  useEffect(() => {
    setSettings({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(SETTINGS_KEY, {}) });
    const adopt = (u: User) => {
      const k = keys(u.id);
      setAll(load<DayEvent[]>(k.events, []));
      setPending(load<Record<string, string>>(k.pending, {}));
      setLastSync(load<string | null>(k.lastSync, null));
      setUser(u);
      setReady(true);
    };
    // Start from the remembered account so the app opens instantly (and offline),
    // then confirm the session with the server.
    const cached = load<User | null>(USER_KEY, null);
    if (cached) adopt(cached);
    me()
      .then((u) => {
        save(USER_KEY, u);
        if (!cached || cached.id !== u.id) adopt(u);
        else setUser(u);
      })
      .catch((err) => {
        if (err instanceof AuthError) {
          remove(USER_KEY);
          setUser(null);
          setStatus("signedout");
          setReady(true);
          toLogin();
        } else if (!cached) {
          setReady(true); // offline and never signed in here
        }
      });
  }, []);

  const uid = user?.id;
  useEffect(() => void (ready && uid && save(keys(uid).events, all)), [ready, uid, all]);
  useEffect(() => void (ready && uid && save(keys(uid).pending, pending)), [ready, uid, pending]);
  useEffect(() => void (ready && save(SETTINGS_KEY, settings)), [ready, settings]);
  useEffect(() => void (ready && uid && save(keys(uid).lastSync, lastSync)), [ready, uid, lastSync]);

  /* ---------- theme ---------- */
  useEffect(() => {
    if (!ready) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#09090b" : "#fafafa");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [ready, settings.theme]);

  /* ---------- sync ---------- */
  const syncNow = useCallback(async () => {
    if (!userRef.current) {
      setStatus("signedout");
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
      const remote = changed.length ? await pushEvents(changed) : await listEvents();
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
      if (err instanceof AuthError) return toLogin();
      setError(err instanceof Error ? err.message : String(err));
      setStatus(navigator.onLine ? "error" : "offline");
    } finally {
      syncing.current = false;
    }
  }, []);

  // Sync on start, when connectivity returns, and every 5 minutes.
  useEffect(() => {
    if (!ready || !uid) return;
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
  }, [ready, uid, syncNow]);

  // Push local changes shortly after they happen.
  const pendingCount = Object.keys(pending).length;
  useEffect(() => {
    if (!ready || !pendingCount || !settings.autoSync || !uid) return;
    const t = window.setTimeout(() => void syncNow(), 1200);
    return () => window.clearTimeout(t);
  }, [ready, pending, pendingCount, settings.autoSync, uid, syncNow]);

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
      if (mode === "replace") {
        if (userRef.current && navigator.onLine) {
          setStatus("syncing");
          try {
            const remote = await replaceAll(stamped);
            setAll(remote);
            setPending({});
            setLastSync(new Date().toISOString());
            setStatus("idle");
            return;
          } catch (err) {
            if (err instanceof AuthError) toLogin();
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
            throw err;
          }
        }
        // Offline: replace locally, delete the rest when we next sync.
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

  const logout = useCallback(async () => {
    const u = userRef.current;
    try {
      await apiLogout();
    } catch {
      /* offline: the cookie expires on its own; still forget the account here */
    }
    if (u) for (const k of Object.values(keys(u.id))) remove(k);
    remove(USER_KEY);
    location.replace("/login");
  }, []);

  const events = useMemo(() => all.filter((e) => !e.deleted), [all]);
  const getEvent = useCallback((id: string) => events.find((e) => e.id === id), [events]);

  const value: Store = {
    ready,
    user,
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
    logout,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
