# HabitGrid

A simple weekly habit grid. Habits are rows, days are columns. Tick a box, move between weeks.

- **Installable PWA**: add it to your Android home screen or install it on desktop. It opens and works offline.
- **Offline-first**: every change is saved on the device first, then synced when you're back online.
- **Plain JSON**: all data is one human-readable file (`habits.json`) in a private GitHub repo you own. Download a copy any time from Settings.
- **Reminders**: optional Web Push notification per habit, at a time you choose.
- **Free to run**: Vercel Hobby, GitHub private repo, and a free cron service. No credit card.

Forked from [nagaoo0/HabitGrid](https://github.com/nagaoo0/HabitGrid) and rebuilt around a single JSON document. The Supabase and Git-integration code has been removed.

> **Live setup, projects and secret locations:** see [docs/OPERATIONS.md](docs/OPERATIONS.md). It lists names and locations only, never values.

## How it fits together

```
Phone / desktop (PWA)  ──PUT /api/data──►  Vercel function  ──Contents API──►  private GitHub repo
  localStorage (offline)  ◄── merged ──      merges + validates                 habits.json (history = backups)
                                                                                push.json (reminder devices)
cron-job.org (free) ──every 15 min──► /api/cron/remind ──Web Push──► Android / desktop Chrome
```

- Data lives in **your** private data repo, not in this code repo.
- Merging is per record: habits by id, checks by (habit, date), newest edit wins, deletions are kept as tombstones. Two devices edited offline? Nothing gets lost.

## One-time setup (about 20 minutes, all free)

1. **Fork or clone this repo** and push it to GitHub. Make it public or private, either is fine.
2. **Create a private data repo**, e.g. `habitgrid-data`. Leave it empty. Its commits are your backup history.
3. **Create a GitHub token**: Settings → Developer settings → Fine-grained tokens. Limit it to the data repo, with *Contents: Read and write*. Keep it for step 5.
4. **Generate VAPID keys** for notifications (run locally):
   ```bash
   npx web-push generate-vapid-keys
   ```
5. **Deploy to Vercel**: New Project → import the repo. Framework preset: Vite. Add these environment variables (see `.env.example`):

   | Variable | Value |
   |---|---|
   | `VITE_VAPID_PUBLIC_KEY` | public VAPID key |
   | `SYNC_TOKEN` | a long random string (`openssl rand -hex 32`) |
   | `GITHUB_TOKEN` | the fine-grained token from step 3 |
   | `GITHUB_DATA_REPO` | `your-name/habitgrid-data` |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | the VAPID pair |
   | `VAPID_SUBJECT` | `mailto:you@example.com` (your own address) |
   | `CRON_SECRET` | another long random string |

   Deploy. Then redeploy once so `VITE_` variables are included in the build.
6. **Schedule reminders** with [cron-job.org](https://cron-job.org) (free, no card). Create a job:
   - URL: `https://<your-app>.vercel.app/api/cron/remind`
   - Schedule: every 15 minutes
   - Header: `Authorization: Bearer <CRON_SECRET>`
7. **Set up each device**: open the site, go to **Settings**, paste `SYNC_TOKEN`, then (optional) turn on **Reminders**.
   - **Android**: open in Chrome → menu → *Add to Home screen* (or *Install app*).
   - **Desktop**: Chrome or Edge → install icon in the address bar.

## Backup, export and portability

- **Settings → Download JSON** saves a copy. **Import JSON** merges one in. Nothing is overwritten.
- The data repo holds the full history of `habits.json`. Clone it to back everything up.
- The file format is documented in `shared/doc.js`.

## Development

```bash
npm install
npm run dev      # app on http://localhost:3000 (sync and reminders need Vercel or `vercel dev`)
npm test         # merge, reminder and sync-route tests
npm run build
```

## Notes and limits

- Reminders are Web Push. They arrive on Android Chrome and desktop Chrome/Edge. On iPhone they need the app installed to the home screen (iOS 16.4+).
- Reminders run on a 15-minute schedule, so a notification can arrive up to 15 minutes after its time.
- The sync token is stored in the browser on each device. Anyone with it can read and change your habits, so keep it private.
- The app code is MIT licensed (see `LICENSE`). Your habit data never goes into this repo.
