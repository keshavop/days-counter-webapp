"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { COVERS, FONTS, REPEATS, TEXT_COLORS, type DayEvent } from "@/lib/types";
import { parseDate } from "@/lib/dates";
import { requestNotifications } from "@/lib/reminders";
import { CounterCard } from "./CounterCard";
import { Field, Section, Segmented, UnitChips, buttonClass, inputClass } from "./Controls";
import { IconBack, IconCheck, IconImage } from "./Icons";

/** Sheets cells hold at most 50,000 characters; keep uploaded images safely under that. */
const MAX_IMAGE_CHARS = 45_000;

async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image"));
      el.src = url;
    });
    for (const [width, quality] of [
      [640, 0.6],
      [480, 0.55],
      [360, 0.5],
      [280, 0.45],
    ] as const) {
      const scale = Math.min(1, width / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= MAX_IMAGE_CHARS) return data;
    }
    throw new Error("That image is too detailed to store in the sheet. Try a smaller one or paste an image link.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function EventForm({ initial, isNew }: { initial: DayEvent; isNew: boolean }) {
  const { saveEvent } = useStore();
  const router = useRouter();
  const [ev, setEv] = useState<DayEvent>(initial);
  const [reminderOn, setReminderOn] = useState(Boolean(initial.reminder_at));
  const [imageError, setImageError] = useState("");
  const [titleError, setTitleError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof DayEvent>(key: K, value: DayEvent[K]) => setEv((p) => ({ ...p, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!ev.title.trim()) {
      setTitleError("Give your event a name");
      document.getElementById("title")?.focus();
      return;
    }
    if (!parseDate(ev.date)) return;
    const final: DayEvent = {
      ...ev,
      title: ev.title.trim(),
      reminder_at: reminderOn ? ev.reminder_at : "",
      notify_text: reminderOn ? ev.notify_text : "",
    };
    saveEvent(final);
    router.push(`/event?id=${encodeURIComponent(final.id)}`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImageError("");
    try {
      set("image", await compressImage(file));
      if (ev.dim < 25) set("dim", 35);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : String(err));
    }
  };

  const preview = <CounterCard event={ev} scale={0.85} className="aspect-[16/10] w-full rounded-[24px]" />;

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-6xl" noValidate>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur md:px-10">
        <Link
          href={isNew ? "/" : `/event?id=${encodeURIComponent(ev.id)}`}
          aria-label="Cancel"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-card hover:bg-seg"
        >
          <IconBack />
        </Link>
        <h1 className="flex-1 font-display text-xl font-bold">{isNew ? "New event" : "Edit event"}</h1>
        <button type="submit" className={`${buttonClass.primary} h-11 px-4`}>
          <IconCheck size={18} /> {isNew ? "Add event" : "Save"}
        </button>
      </header>

      <div className="flex flex-col gap-5 px-4 pb-16 pt-4 md:flex-row-reverse md:items-start md:gap-8 md:px-10 md:pt-8">
        {/* Preview: sticky under the header on mobile, a side panel on desktop. */}
        <div className="sticky top-[69px] z-10 -mx-4 bg-bg/95 px-4 pb-3 backdrop-blur md:top-24 md:mx-0 md:w-[420px] md:shrink-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <p className="mb-2 hidden text-xs font-semibold uppercase tracking-[0.08em] text-muted md:block">Live preview</p>
          {preview}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Section title="Basics">
            <Field label="Title" htmlFor="title" hint={titleError ? <span className="text-danger">{titleError}</span> : undefined}>
              <input
                id="title"
                className={inputClass}
                value={ev.title}
                maxLength={80}
                placeholder="e.g. Goa trip"
                aria-invalid={Boolean(titleError)}
                onChange={(e) => {
                  set("title", e.target.value);
                  setTitleError("");
                }}
              />
            </Field>
            <Field label="Date" htmlFor="date" hint="Pick a past date to count up from it.">
              <input id="date" type="date" required className={inputClass} value={ev.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="description">
              <textarea
                id="description"
                rows={3}
                className={`${inputClass} h-auto py-3`}
                value={ev.description}
                placeholder="Anything worth remembering"
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Counter">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Repeat</span>
              <Segmented label="Repeat" value={ev.repeat} options={REPEATS} onChange={(v) => set("repeat", v)} />
              <p className="text-[13px] text-muted">Repeating events count down to their next date, like birthdays.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Show as</span>
              <UnitChips value={ev.format} onChange={(v) => set("format", v)} />
            </div>
          </Section>

          <Section
            title="Reminder"
            action={
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={reminderOn}
                  onChange={async (e) => {
                    setReminderOn(e.target.checked);
                    if (e.target.checked) {
                      if (!ev.reminder_at) set("reminder_at", `${ev.date}T09:00`);
                      await requestNotifications();
                    }
                  }}
                />
                On
              </label>
            }
          >
            {reminderOn ? (
              <>
                <Field label="Remind me at" htmlFor="reminder_at">
                  <input
                    id="reminder_at"
                    type="datetime-local"
                    className={inputClass}
                    value={ev.reminder_at}
                    onChange={(e) => set("reminder_at", e.target.value)}
                  />
                </Field>
                <Field label="Notification text" htmlFor="notify_text">
                  <input
                    id="notify_text"
                    className={inputClass}
                    value={ev.notify_text}
                    placeholder={`Reminder for ${ev.title || "your event"}`}
                    onChange={(e) => set("notify_text", e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p className="text-[15px] text-muted">No reminder. Turn it on to get a notification on this device.</p>
            )}
          </Section>

          <Section title="Style">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Cover</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {COVERS.map((c) => {
                  const on = !ev.image && ev.cover === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={`${c.name} cover`}
                      aria-pressed={on}
                      onClick={() => {
                        setEv((p) => ({ ...p, cover: c.hex, image: "", color: c.name === "Sand" ? "#111827" : p.color === "#111827" ? "#ffffff" : p.color }));
                      }}
                      className={`size-11 rounded-xl border-2 ${on ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`flex h-11 items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${ev.image ? "border-accent" : "border-dashed border-line"} hover:bg-seg`}
                >
                  <IconImage size={18} /> {ev.image ? "Change photo" : "Photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onFile(e.target.files?.[0])} />
                {ev.image && (
                  <button type="button" className="text-sm font-semibold text-accent-text hover:underline" onClick={() => set("image", "")}>
                    Remove photo
                  </button>
                )}
              </div>
              {imageError && <p className="text-[13px] text-danger">{imageError}</p>}
              <label htmlFor="image_url" className="sr-only">
                Or paste an image link
              </label>
              <input
                id="image_url"
                type="url"
                className={inputClass}
                placeholder="…or paste an image link (https://)"
                value={ev.image.startsWith("data:") ? "" : ev.image}
                onChange={(e) => set("image", e.target.value.trim())}
              />
            </div>

            <Field label={`Picture dim · ${ev.dim}%`} htmlFor="dim">
              <input id="dim" type="range" min={0} max={80} step={5} value={ev.dim} onChange={(e) => set("dim", Number(e.target.value))} className="h-11 w-full" />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Font" htmlFor="font">
                <select id="font" className={inputClass} value={ev.font} onChange={(e) => set("font", e.target.value as DayEvent["font"])}>
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Counter size" htmlFor="counter_size">
                <select id="counter_size" className={inputClass} value={ev.counter_size} onChange={(e) => set("counter_size", Number(e.target.value))}>
                  {[48, 56, 64, 72, 88, 104, 120].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title size" htmlFor="title_size">
                <select id="title_size" className={inputClass} value={ev.title_size} onChange={(e) => set("title_size", Number(e.target.value))}>
                  {[14, 16, 18, 20, 24, 28, 32].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Text colour</span>
                <div className="flex items-center gap-2.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={`${c.name} text`}
                      aria-pressed={ev.color === c.hex}
                      onClick={() => set("color", c.hex)}
                      className={`size-11 rounded-full border-2 ${ev.color === c.hex ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                  <label className="relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line text-xs font-semibold text-muted">
                    <span aria-hidden="true">+</span>
                    <span className="sr-only">Custom text colour</span>
                    <input type="color" value={ev.color} onChange={(e) => set("color", e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                </div>
              </div>
              <label className="flex h-11 items-center gap-3 text-[15px] font-medium">
                <input type="checkbox" className="size-5" checked={ev.divider} onChange={(e) => set("divider", e.target.checked)} />
                Show divider line
              </label>
            </div>
          </Section>

          <button type="submit" className={`${buttonClass.primary} w-full md:hidden`}>
            {isNew ? "Add event" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
