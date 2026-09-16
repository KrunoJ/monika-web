# Meetup ticket API (Embedded Checkout)

Same-origin PHP endpoints for `/meetup` ticket purchase.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/meetup/ticket-status` | Current tier, price, early-bird availability |
| `GET` | `/api/meetup/session-status?session_id=` | Verify Checkout Session paid state before thank-you |
| `POST` | `/api/meetup/create-checkout` | Reserve a seat, then create Embedded Checkout Session (`quantity: 1`) |
| `POST` | `/api/meetup/webhook` | Sync inventory on paid / expired Checkout Sessions |

## Environment / config

Set host env vars **or** copy `config.example.php` → `config.local.php`:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (`whsec_...` from the Stripe destination)
- `STRIPE_PRICE_EARLY_BIRD`
- `STRIPE_PRICE_STANDARD`
- `SITE_ORIGIN` (optional, e.g. `https://monikajagic.com`)

Never commit `config.local.php` or secret keys.

## Inventory + reservations

`data/inventory.json` stores sold counts and short-lived checkout reservations:

- Seed (mock UI only): `earlyBirdSold=3` → **7 of 10** early bird still available
- After go-live: reset `earlyBirdSold` / `totalSold` to real Stripe totals (or `0`) before trusting the meter
- `create-checkout` **reserves** one seat under file lock (30 min TTL) before creating the Stripe session
- `ticket-status` subtracts active reservations from availability / tier
- Webhook `checkout.session.completed` increments sold counts idempotently and consumes the reservation
- Webhook `checkout.session.expired` releases the reservation without incrementing sold
- `currentTier`: `early_bird` while early bird remains (sold + reserved), then `standard`, then `sold_out` at 30

Without Stripe keys configured, `create-checkout` returns **503** `{ "error": "checkout_unavailable" }`.

Without `stripe_webhook_secret`, webhook returns **503**.

## Stripe webhook destination

- URL: `https://monikajagic.com/api/meetup/webhook`
- Events:
  - `checkout.session.completed`
  - `checkout.session.expired` (needed to free reservations)
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

See `TEST.md` for the full go-live checklist.
