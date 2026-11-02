import type { DayEvent } from "./types";

const KEY = "dc.notified";
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Show a notification for every reminder that has come due in the last 24 hours and hasn't
 * been shown yet. Runs while the app is open (or installed and running); web apps can't
 * schedule notifications for when they are fully closed without a push server.
 */
export async function checkReminders(events: DayEvent[]): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  let shown: string[] = [];
  try {
    shown = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    shown = [];
  }
  const now = Date.now();
  const due = events.filter((e) => {
    if (!e.reminder_at) return false;
    const at = new Date(e.reminder_at).getTime();
    return !Number.isNaN(at) && at <= now && now - at < WINDOW_MS && !shown.includes(`${e.id}|${e.reminder_at}`);
  });
  if (!due.length) return;

  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  for (const e of due) {
    const body = e.notify_text || `Reminder for ${e.title}`;
    const options: NotificationOptions = { body, tag: e.id, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: `/event?id=${encodeURIComponent(e.id)}` } };
    try {
      if (reg) await reg.showNotification(e.title, options);
      else new Notification(e.title, options);
    } catch {
      /* ignore: some browsers block page-level notifications */
    }
    shown.push(`${e.id}|${e.reminder_at}`);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(shown.slice(-200)));
  } catch {
    /* ignore */
  }
}

export async function requestNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
