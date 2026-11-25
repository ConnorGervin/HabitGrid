# Operations: what is deployed, where, and which secrets exist

This file records the live setup. It lists **names and locations** of secrets, never their values.
Keep it up to date when you rotate anything.

## Live deployment

| Item | Value |
|---|---|
| App URL | https://habitgrid-sooty.vercel.app |
| Vercel project | `habitgrid` (team `connor-gervin-personal`, project id `prj_TQeGV7eZWRS1OhY7LdjQbvpjnNwQ`) |
| Vercel account | `connorgervin` (CLI logged in) |
| Git source | fork `ConnorGervin/habitgrid`, branch `habitgrid-pwa-rebuild` |
| Auto-deploy from GitHub | **Not connected yet.** The Vercel GitHub app needs access to the fork. Until then deploy with `vercel deploy --prod` from this repo |

## Repositories

| Repo | Visibility | Purpose |
|---|---|---|
| `ConnorGervin/habitgrid` (this repo) | public fork | app code. The rebuild lives on `habitgrid-pwa-rebuild`; `main` still has the old upstream code |
| `ConnorGervin/habitgrid-data` | **private** | the habit data. `habits.json` (all habits and ticks) and `push.json` (reminder devices). Every sync is a commit, so the history is your backup |
| `nagaoo0/HabitGrid` | upstream | original project this was forked from |

Never store habit data in this repo. It belongs in the private data repo.

## Secrets inventory

Values are not in this repo. They live in the places listed below.

| Name | Where the value lives | What it does | If it leaks |
|---|---|---|---|
| `GITHUB_TOKEN` | Vercel env (production) | fine-grained GitHub token, Contents read/write on `habitgrid-data` only | revoke at github.com/settings/tokens, create a new one, update Vercel |
| `GITHUB_DATA_REPO` | Vercel env | `ConnorGervin/habitgrid-data` | not secret, but see above |
| `SYNC_TOKEN` | Vercel env, and typed into Settings on each device | bearer token that guards `/api/data` | anyone with it can read/write habits. Rotate: new value in Vercel, redeploy, update every device |
| `CRON_SECRET` | Vercel env, and the cron-job.org request header | guards `/api/cron/remind` | rotate in Vercel and in cron-job.org |
| `VAPID_PUBLIC_KEY`, `VITE_VAPID_PUBLIC_KEY` | Vercel env (the second is baked into the browser build) | identifies the server to push services | not secret. Changing the pair invalidates all reminder devices, so they must re-enable reminders |
| `VAPID_PRIVATE_KEY` | Vercel env | signs push messages | regenerate with `npx web-push generate-vapid-keys`, update both VAPID vars, redeploy, re-enable reminders |
| `VAPID_SUBJECT` | Vercel env | `mailto:` contact for push services | change if the contact changes |

Local copy: `/home/user/habitgrid-secrets.env` in the sandbox where the values were generated (mode 600, outside the repo). The sandbox is not durable, so copy the values into a password manager.

`.env*` is git-ignored, so secrets files are not committed.

## External services

| Service | Status | Notes |
|---|---|---|
| Vercel (Hobby) | live | enable two-factor authentication on the account |
| GitHub | fork and data repo created | token was pasted into a chat transcript, so **rotate it** |
| cron-job.org | **not set up yet** | create a free job: URL `https://habitgrid-sooty.vercel.app/api/cron/remind`, every 15 minutes, header `Authorization: Bearer <CRON_SECRET>` |

## Open items

1. Rotate `GITHUB_TOKEN`.
2. Create the cron-job.org job above.
3. Revoke the "Protection Bypass for Automation" secret on the Vercel project. It was created by the `vercel curl` check and is not needed. Command: `vercel project protection disable prj_TQeGV7eZWRS1OhY7LdjQbvpjnNwQ --protection-bypass --protection-bypass-secret <secret>`, or use the Vercel dashboard under Deployment Protection.
4. Connect GitHub auto-deploy (install the Vercel GitHub app on the fork).
5. Open each device, paste `SYNC_TOKEN` into Settings, and enable reminders if wanted.
6. Decide whether `habitgrid-pwa-rebuild` should become the default branch.

## Routine operations

```bash
npm test                    # shared model, reminder logic and sync-route tests
npm run build               # production build
vercel deploy --prod --yes  # deploy from this repo (Vercel CLI must be logged in)
```

Rotating `SYNC_TOKEN`: `vercel env rm SYNC_TOKEN production`, add the new value, redeploy, then update Settings on each device.

## Code map

- `shared/doc.js`: the JSON document format and merge rules (used by app and server)
- `server/github.js`: reads and writes JSON in the data repo with optimistic concurrency
- `api/data.js`: sync endpoint (GET/PUT)
- `api/push/subscribe.js`: stores reminder devices
- `api/cron/remind.js` + `server/reminders.js`: sends due reminders
- `src/lib/store.js`: offline-first local copy. `src/lib/sync.js`: push/pull client
- `public/sw.js`: offline cache and push display
