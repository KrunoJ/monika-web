# Meetup ticket API (Embedded Checkout)

Same-origin PHP endpoints for `/meetup` ticket purchase.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/meetup/ticket-status` | Current tier, price, early-bird availability |
| `POST` | `/api/meetup/create-checkout` | Create Stripe Embedded Checkout Session (`quantity: 1`) |
| `POST` | `/api/meetup/webhook` | Stripe webhook - sync inventory on `checkout.session.completed` |

## Environment / config

Set host env vars **or** copy `config.example.php` → `config.local.php`:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (`whsec_...` from the Stripe destination)
- `STRIPE_PRICE_EARLY_BIRD`
- `STRIPE_PRICE_STANDARD`
- `SITE_ORIGIN` (optional, e.g. `https://monikajagic.com`)

Never commit `config.local.php` or secret keys.

## Inventory

`data/inventory.json` stores sold counts:

- Seed (mock UI only): `earlyBirdSold=3` → **7 of 10** early bird still available
- After go-live: reset `earlyBirdSold` / `totalSold` to real Stripe totals (or `0`) before trusting the meter
- Webhook `checkout.session.completed` increments counts idempotently via `processedSessionIds`
- `currentTier`: `early_bird` while early bird remains, then `standard`, then `sold_out` at 30

`create-checkout` chooses Early bird vs Standard from inventory but does **not** increment sold counts (webhook does).

Without Stripe keys configured, `create-checkout` returns **503** `{ "error": "checkout_unavailable" }`.

Without `stripe_webhook_secret`, webhook returns **503**.

## Stripe webhook destination

- URL: `https://monikajagic.com/api/meetup/webhook`
- Event: `checkout.session.completed`
- Paste signing secret into `stripe_webhook_secret`

## Apache

Root `.htaccess` maps clean URLs to the PHP files. `data/` is blocked from direct HTTP access.

## Local check

```bash
php -S 127.0.0.1:8765 router.php
curl -s http://127.0.0.1:8765/api/meetup/ticket-status
curl -s -X POST http://127.0.0.1:8765/api/meetup/create-checkout \
  -H 'Content-Type: application/json' \
  -d '{"quantity":1}'
```
