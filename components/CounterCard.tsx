import type { DayEvent } from "@/lib/types";
import { fontClass } from "@/lib/types";
import { countdown, formatDate } from "@/lib/dates";

type Look = Pick<
  DayEvent,
  "title" | "date" | "repeat" | "format" | "cover" | "image" | "dim" | "font" | "counter_size" | "title_size" | "color" | "divider"
>;

/**
 * The styled counter "poster": cover colour or photo, dim overlay, big counter, divider, title.
 * Used as the live preview in the editor and as the hero on the detail page.
 * `scale` shrinks the user's chosen font sizes for smaller placements.
 */
export function CounterCard({
  event,
  scale = 1,
  className = "",
  showDate = true,
}: {
  event: Look;
  scale?: number;
  className?: string;
  showDate?: boolean;
}) {
  const c = countdown(event.date, event.repeat, event.format);
  const font = fontClass(event.font);
  const counterPx = Math.round(event.counter_size * scale);
  const titlePx = Math.round(event.title_size * scale);

  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center overflow-hidden text-center ${className}`}
      style={{ backgroundColor: event.cover, color: event.color }}
    >
      {event.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.image} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black" style={{ opacity: event.dim / 100 }} />
      <div className={`px-6 ${font}`}>
        {c ? (
          <>
            <div className="font-bold leading-[0.95] tracking-tight" style={{ fontSize: counterPx }}>
              {c.num}
            </div>
            {c.caption && (
              <div className="mt-1.5 font-medium opacity-90" style={{ fontSize: Math.max(13, Math.round(titlePx * 0.8)) }}>
                {c.caption}
              </div>
            )}
          </>
        ) : (
          <div className="font-bold" style={{ fontSize: counterPx * 0.6 }}>
            Pick a date
          </div>
        )}
        {event.divider && <div aria-hidden="true" className="mx-auto my-3 h-0.5 w-28 rounded-full" style={{ backgroundColor: event.color, opacity: 0.75 }} />}
        <div className={`font-semibold leading-tight ${event.divider ? "" : "mt-3"}`} style={{ fontSize: titlePx }}>
          {event.title || "Event title"}
        </div>
        {showDate && c && <div className="mt-1 text-sm opacity-90">{formatDate(c.target, true)}</div>}
      </div>
    </div>
  );
}
