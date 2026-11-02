"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { EventForm } from "@/components/EventForm";
import { NotFound } from "@/components/NotFound";

function EditEvent() {
  const id = useSearchParams().get("id") ?? "";
  const { ready, getEvent } = useStore();
  if (!ready) return null;
  const ev = getEvent(id);
  if (!ev) return <NotFound />;
  return <EventForm key={ev.id} initial={ev} isNew={false} />;
}

export default function EditEventPage() {
  return (
    <Suspense>
      <EditEvent />
    </Suspense>
  );
}
