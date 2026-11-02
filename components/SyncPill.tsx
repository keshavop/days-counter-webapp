"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/dates";
import { IconAlert, IconCloud, IconCloudCheck, IconCloudOff, IconRefresh } from "./Icons";

/** Small status chip: synced / syncing / offline / error / not connected. Links to the Sync page. */
export function SyncPill({ className = "" }: { className?: string }) {
  const { status, lastSync, pendingCount, ready } = useStore();
  if (!ready) return null;

  let icon = <IconCloudCheck size={16} className="text-ok" />;
  let text = `Synced ${relativeTime(lastSync)}`;
  if (status === "syncing") {
    icon = <IconRefresh size={16} className="animate-spin text-accent-text" />;
    text = "Syncing…";
  } else if (status === "offline") {
    icon = <IconCloudOff size={16} className="text-warn" />;
    text = pendingCount ? `Offline · ${pendingCount} queued` : "Offline";
  } else if (status === "error") {
    icon = <IconAlert size={16} className="text-danger" />;
    text = "Sync failed";
  } else if (status === "unconfigured") {
    icon = <IconCloud size={16} className="text-muted" />;
    text = "Connect sheet";
  } else if (pendingCount) {
    icon = <IconRefresh size={16} className="text-accent-text" />;
    text = `${pendingCount} to sync`;
  }

  return (
    <Link
      href="/sync"
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] font-medium text-ink hover:bg-seg ${className}`}
      aria-live="polite"
    >
      {icon}
      <span className="whitespace-nowrap">{text}</span>
    </Link>
  );
}
