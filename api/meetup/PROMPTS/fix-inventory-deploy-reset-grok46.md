# Prompt (Grok 4.6) — Stop meetup inventory reset on deploy

You are working in the monika-web repo. Fix one production bug only: every web deploy resets sold meetup ticket counts to zero.

## Problem (confirmed)

- Live sold counts live in `api/meetup/data/inventory.json`.
- That file is **git-tracked** with a seed of `earlyBirdSold: 0` / `totalSold: 0`.
- `.gitignore` only ignores `inventory.json.tmp`, not the real inventory file.
- Hostinger (or any git/rsync deploy) overwrites the live file with the repo seed on every deploy → sold counts reset; `processedSessionIds` wiped.

Do **not** change Stripe Checkout, webhook pricing, MailerLite, thank-you validation, soft-hold architecture, or frontend ticket UI beyond what is required for this fix.

## Goal

Runtime inventory must **survive deploys**. Repo may ship an example/seed for documentation, but must never overwrite live sold data.

## Required implementation

1. **Runtime store path**
   - Change the live inventory path to `api/meetup/data/inventory.local.json`.
   - Update `meetup_inventory_path()` in `api/meetup/lib/inventory.php` accordingly.
   - Keep using the same JSON schema and existing lock/write helpers.

2. **One-time migration**
   - If `inventory.local.json` is missing and legacy `inventory.json` exists on disk, copy legacy → local before first read/write.
   - If neither exists, create local from `meetup_inventory_default()` (same as today).
   - Never write sold counts back into a git-tracked seed file.

3. **Git hygiene**
   - Add to `.gitignore`:
     - `api/meetup/data/inventory.local.json`
     - `api/meetup/data/inventory.json`
     - keep `api/meetup/data/inventory.json.tmp` (already ignored)
   - Stop tracking `api/meetup/data/inventory.json` (`git rm --cached`).
   - Add `api/meetup/data/inventory.example.json` with the zero seed + short comment in README that this is docs/example only.

4. **Docs**
   - Update `api/meetup/README.md` (and `TEST.md` if needed):
     - explain local vs example file
     - **mandatory Hostinger note before first deploy of this change:** on the server, rename/copy live `inventory.json` → `inventory.local.json` so the first pull cannot wipe current sold counts (live recently had sold > 0).
   - Remove outdated wording that invents soft-hold if still present in README create-checkout line.

5. **Constraints**
   - No new database.
   - No inventory architecture redesign.
   - No soft-hold reintroduction.
   - No commit of real sold data or secrets.
   - Use ASCII hyphen `-` only in new copy.
   - PHP `declare(strict_types=1);` style consistent with neighboring files.

## Acceptance criteria

- [ ] Runtime reads/writes only `inventory.local.json`.
- [ ] `inventory.local.json` is gitignored and not tracked.
- [ ] Repo no longer tracks a live `inventory.json` seed that deploy would overwrite.
- [ ] Example seed exists for humans (`inventory.example.json`).
- [ ] Legacy file on server is migrated to local when local is missing.
- [ ] Ticket status / checkout / webhook still use the same inventory API functions.
- [ ] README documents the one-time server rename before first deploy.

## Out of scope

- Fixing oversell/race conditions.
- Switching Stripe test → live keys.
- Cookie/privacy/frontend redesign.

## Deliver

Implement the above, commit on a `cursor/*-2e6e` branch, merge/push to `main` if that is the project norm for meetup ops fixes, and report: files changed, migration behavior, and the exact pre-deploy server step needed so current live sold counts are not lost.
