# Days Counter

Countdowns to the days that matter and count-ups from the ones that changed you. It's an installable **PWA** built with **Next.js (App Router) + Tailwind CSS v4**. Events are stored in **your own Google Sheet** through a small Google Apps Script, and the sheet can be exported or imported as **CSV**.

## Features

- **Upcoming / Since tabs.** A "Next up" hero card, search, sorting, and progress bars.
- **Event editor with live preview.** Set the title, date, notes, and repeat (once, weekly, monthly, yearly). Choose the counter format (years, months, weeks, days). Style the card with a cover colour or photo, picture dim, font, counter and title sizes, text colour, and a divider line.
- **Event detail.** Shows the full breakdown (y/m/d, w/d, hours), notes, reminder, sync state, sharing, and delete.
- **Date calculator.** Works out the gap between two dates in any units, with a weekday count, an optional "include end date", and saving the result as an event.
- **Google Sheets sync.** Works offline first, so every change is saved on the device immediately. Changes are pushed about a second later, and the app pulls on start, when you come back online, and every 5 minutes. Conflicts are resolved by newest `updated_at`. Rows you edit by hand in the sheet sync back to the app.
- **CSV backup.** Export everything, or import in merge or replace mode. CSV columns match the sheet.
- **PWA.** Installable, works offline (a service worker caches the app shell), and has app shortcuts and maskable icons.
- **Reminders.** Notifications are shown while the app is open or running in the background.
- **Themes.** Light, dark, or follow the system.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

The service worker only registers in production builds (`npm run build && npm start`), so caching never gets in the way during development.

## Connect your Google Sheet

1. Create a Google Sheet.
2. Open **Extensions → Apps Script** and paste in [`public/apps-script/Code.gs`](public/apps-script/Code.gs). The Sync page in the app also has a **Copy Apps Script code** button.
3. Optional: under **Project settings → Script properties**, add `API_KEY` = a secret of your choice.
4. Go to **Deploy → New deployment → Web app**. Set *Execute as:* **Me** and *Who has access:* **Anyone**, then authorise.
5. Open the app's **Sync & data** page, paste the `/exec` URL (and the key if you set one), and press **Connect**.

The script creates an `events` tab with these columns:

```
id, title, date, description, reminder_at, notify_text, repeat, format, cover, image,
dim, font, counter_size, title_size, color, divider, created_at, updated_at, deleted
```

To pre-fill the script URL for every visitor, set `NEXT_PUBLIC_APPS_SCRIPT_URL` (see `.env.example`).

### How the API works

| Request | Purpose |
| --- | --- |
| `GET ?action=ping&key=…` | Check the connection; returns the sheet's name and URL |
| `GET ?action=list&key=…` | Read all rows |
| `GET ?action=csv&key=…` | Download the sheet as CSV |
| `POST {action:"upsert", key, rows}` | Insert or update rows by `id` (newer wins); rows marked `deleted` are removed |
| `POST {action:"replace", key, rows}` | Overwrite the whole sheet (used by CSV "Replace all") |

POST bodies are sent as `text/plain` JSON so the browser makes a simple request with no CORS preflight, because Apps Script can't answer a preflight. Every POST returns the full row list, so a sync takes a single request.

## Project layout

```
app/                 routes: / (events), /new, /event?id=, /edit?id=, /calculator, /sync, manifest.ts
components/          AppShell (sidebar + tab bar), CounterCard, EventForm, Controls, Icons, SyncPill
lib/dates.ts         date math: countdowns, repeats, y/m/w/d breakdowns
lib/serialize.ts     event ⇄ sheet row ⇄ CSV
lib/sheets.ts        Apps Script client
lib/store.tsx        local-first store, sync engine, install prompt, reminders
public/sw.js         service worker
public/apps-script/  Google Apps Script backend
scripts/             icon generator (npm run icons)
```

## Notes and limits

- Uploaded photos are compressed to fit in one sheet cell (50,000 characters at most). For bigger images, paste an image link instead.
- Web apps can't schedule notifications while fully closed unless there is a push server. Reminders fire the next time the app is open or running.
