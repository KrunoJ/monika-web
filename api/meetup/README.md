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
- `MAILER_LITE_API_TOKEN` (optional until go-live; meetup attendees sync)
- `MAILER_LITE_GROUP_ID` (meetup attendees group)

Never commit `config.local.php` or secret keys.

## Inventory

`data/inventory.json` stores paid sold counts only:

- Initial state: `earlyBirdSold=0`, `totalSold=0` → **10 of 10** early bird available
- `create-checkout` picks the current tier from sold counts (no soft-hold reservation)
- Webhook `checkout.session.completed` increments sold counts idempotently
- `currentTier`: `early_bird` while early bird remains, then `standard`, then `sold_out` at 30

Without Stripe keys configured, `create-checkout` returns **503** `{ "error": "checkout_unavailable" }`.

Without `stripe_webhook_secret`, webhook returns **503**.

## Stripe webhook destination

- URL: `https://monikajagic.com/api/meetup/webhook`
- Events:
  - `checkout.session.completed` (required - this is when a seat is counted as sold)
  - `checkout.session.expired` (optional; harmless if present)
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
