"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EventForm } from "@/components/EventForm";
import { blankEvent } from "@/lib/serialize";
import { parseDate } from "@/lib/dates";

function NewEvent() {
  const params = useSearchParams();
  // The date calculator can hand over a date and title: /new?date=2027-03-15&title=…
  const initial = useMemo(() => {
    const date = params.get("date") ?? "";
    return blankEvent({
      ...(parseDate(date) ? { date } : {}),
      title: params.get("title") ?? "",
    });
  }, [params]);
  return <EventForm key={initial.id} initial={initial} isNew />;
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEvent />
    </Suspense>
  );
}
