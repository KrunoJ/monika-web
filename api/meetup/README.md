# Meetup ticket API (Embedded Checkout)

Same-origin PHP endpoints for `/meetup` ticket purchase.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/meetup/ticket-status` | Current tier, price, early-bird availability |
| `POST` | `/api/meetup/create-checkout` | Create Stripe Embedded Checkout Session (`quantity: 1`) |

`POST /api/meetup/webhook` comes in a later step (inventory sync from Stripe).

## Environment / config

Set host env vars **or** copy `config.example.php` → `config.local.php`:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (later)
- `STRIPE_PRICE_EARLY_BIRD`
- `STRIPE_PRICE_STANDARD`
- `SITE_ORIGIN` (optional, e.g. `https://monikajagic.com`)

Never commit `config.local.php` or secret keys.

## Inventory (mock for now)

`data/inventory.json` is a temporary store:

- Seed: `earlyBirdSold=3` → **7 of 10** early bird still available
- `currentTier`: `early_bird` while early bird remains, then `standard`, then `sold_out` at 30
- **TODO:** replace mock updates with Stripe webhook counts (do not treat this file as live sales yet)

`create-checkout` chooses Early bird vs Standard from this file but does **not** increment sold counts yet (webhook step).

Without Stripe keys configured, `create-checkout` returns **503** `{ "error": "checkout_unavailable" }` so the frontend can show its offline message.

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
