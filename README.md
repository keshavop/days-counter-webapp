# Days Counter

Countdowns to the days that matter and count-ups from the ones that changed you. It's an installable **PWA** built with **Next.js (App Router) + Tailwind CSS v4**. Each person **signs up and logs in**, and all data (accounts and events) is saved as **CSV files in your Google Drive**, read and written by the app's server through a small Google Apps Script.

## Features

- **Upcoming / Since tabs.** A "Next up" hero card, search, sorting, and progress bars.
- **Event editor with live preview.** Set the title, date, notes, and repeat (once, weekly, monthly, yearly). Choose the counter format (years, months, weeks, days). Style the card with a cover colour or photo, picture dim, font, counter and title sizes, text colour, and a divider line.
- **Event detail.** Shows the full breakdown (y/m/d, w/d, hours), notes, reminder, sync state, sharing, and delete.
- **Date calculator.** Works out the gap between two dates in any units, with a weekday count, an optional "include end date", and saving the result as an event.
- **Accounts.** Sign up with name, email and password; log in on any device. Passwords are hashed with scrypt; the session is a signed, httpOnly cookie that lasts 30 days. Every page except `/login` and `/signup` needs a session, and each account only sees its own events.
- **CSV in Google Drive.** Works offline first, so every change is saved on the device immediately. Changes are pushed about a second later, and the app pulls on start, when you come back online, and every 5 minutes. Conflicts are resolved by newest `updated_at`.
- **CSV backup.** Export everything, or import in merge or replace mode. CSV columns match `events.csv`.
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

## Storage: CSV files in Google Drive

The server keeps two files in one Drive folder:

| file | columns |
| --- | --- |
| `users.csv` | `id, email, name, password_hash, created_at` |
| `events.csv` | `user_id, id, title, date, description, reminder_at, notify_text, repeat, format, cover, image, dim, font, counter_size, title_size, color, divider, created_at, updated_at, deleted` |

With no Drive script configured, the same two files are written to `data/` (gitignored, `DATA_DIR` overrides it), so `npm run dev` works with no setup.

### Connect Google Drive

1. Go to [script.google.com](https://script.google.com) → **New project** and paste in [`public/apps-script/Code.gs`](public/apps-script/Code.gs).
2. Change `const SECRET = "change-me-to-a-long-random-string";` to a long random value (`openssl rand -hex 24`).
3. Optional: **Project settings → Script properties** → `FOLDER_ID` = a Drive folder's id. Otherwise the script creates a **Days Counter data** folder.
4. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Authorise, then copy the `/exec` URL. ("Anyone" is safe: every request needs the secret, and only the server knows it.)
5. In `.env.local` (see `.env.example`):

   ```bash
   AUTH_SECRET=<openssl rand -hex 32>
   DRIVE_SCRIPT_URL=https://script.google.com/macros/s/…/exec
   DRIVE_SCRIPT_SECRET=<the same secret as in the script>
   ```

6. Restart the app. After editing the script later: **Deploy → Manage deployments → Edit → Version: New version**, so the same URL serves the new code.

The app needs a Node server (`npm run build && npm start`, or any host that runs Next.js route handlers); the local `data/` fallback also needs a writable disk.

### API

All routes are on the app itself and return JSON. Events routes need the session cookie.

| Request | Purpose |
| --- | --- |
| `POST /api/auth/signup {name, email, password}` | Create an account and sign in |
| `POST /api/auth/login {email, password}` | Sign in |
| `POST /api/auth/logout` | Sign out |
| `GET /api/auth/me` | The signed-in user, or 401 |
| `GET /api/events` | This account's events |
| `POST /api/events {action:"upsert", rows}` | Insert or update rows by `id` (newer wins); rows marked `deleted` are removed |
| `POST /api/events {action:"replace", rows}` | Overwrite this account's events (CSV "Replace all") |

Every events request returns the account's full list, so a sync takes one request. The server serialises writes so two requests never overwrite each other, and the Apps Script takes a lock around each read and write.

## Project layout

```
app/                 routes: / (events), /new, /event?id=, /edit?id=, /calculator, /sync, /login, /signup, manifest.ts
app/api/             auth (signup, login, logout, me) and events route handlers
components/          AppShell (sidebar + tab bar), AuthScreen, CounterCard, EventForm, Controls, Icons, SyncPill
lib/dates.ts         date math: countdowns, repeats, y/m/w/d breakdowns
lib/serialize.ts     event ⇄ CSV row ⇄ CSV text
lib/api.ts           client for app/api
lib/session.ts       signed session cookie (shared by proxy.ts and the routes)
lib/server/          password hashing, current user, CSV tables (Google Drive or data/)
proxy.ts             sends signed-out visitors to /login
lib/store.tsx        local-first store, sync engine, install prompt, reminders
public/sw.js         service worker
public/apps-script/  Google Apps Script that reads and writes the CSV files in Drive
scripts/             icon generator (npm run icons)
```

## Notes and limits

- Uploaded photos are compressed (50,000 characters at most) and stored inline in `events.csv`. For bigger images, paste an image link instead.
- The whole CSV file is read and rewritten on each change, which is fine for personal use and small groups, not for thousands of users.
- Web apps can't schedule notifications while fully closed unless there is a push server. Reminders fire the next time the app is open or running.
