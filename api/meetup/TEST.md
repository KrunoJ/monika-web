# Meetup ticket checkout - test checklist

No secrets in this file. Use `api/meetup/config.local.php` (gitignored) for keys.

## Before testing

- [ ] `config.local.php` has live (or test) `stripe_secret_key` + `stripe_publishable_key`
- [ ] `stripe_price_early_bird` + `stripe_price_standard` filled (`price_...`)
- [ ] `stripe_webhook_secret` filled (`whsec_...`)
- [ ] `site_origin` is `https://monikajagic.com` (or your preview origin)
- [ ] API + `/meetup` files are deployed to the same host as the webhook URL
- [ ] Stripe webhook destination points to `https://monikajagic.com/api/meetup/webhook`
- [ ] Event enabled: `checkout.session.completed`
- [ ] `data/inventory.json` starts at `earlyBirdSold: 0` / `totalSold: 0` (no mock sold counts)

## API smoke checks

```bash
curl -s https://monikajagic.com/api/meetup/ticket-status
curl -s -X POST https://monikajagic.com/api/meetup/create-checkout \
  -H 'Content-Type: application/json' \
  -d '{"quantity":1}'
```

- [ ] `ticket-status` returns JSON with `currentTier`, `earlyBirdAvailable`, `unitAmount`, `publishableKey`
- [ ] With initial seed: early bird available is `10` of `10`, `unitAmount` `2900`, tier `early_bird`
- [ ] `create-checkout` returns `{ "clientSecret": "...", "publishableKey": "pk_..." }` when keys + prices are set
- [ ] Without keys/prices: `create-checkout` returns `503` `{ "error": "checkout_unavailable" }`

## On-page flow (`/meetup` ticket section)

- [ ] Page load updates price / early-bird meter from `ticket-status` (`data-early-bird-source="live"` when API works)
- [ ] Embedded Checkout auto-mounts in `#meetup-checkout` (no ticket-section CTA)
- [ ] Pay with a real card (live) or Stripe test card (if using test keys)
- [ ] Return to `/meetup/?checkout=success&session_id=...#prijava` verifies session is paid, then shows thank-you
- [ ] Fake `?checkout=success` without valid paid `session_id` does **not** show thank-you
- [ ] After paid return, checkout panel is hidden and thank-you is shown
- [ ] When tickets are sold out, checkout stays hidden and price shows **RASPRODANO**

## Webhook + inventory

- [ ] Stripe Dashboard → Webhooks includes `checkout.session.completed`
- [ ] Successful paid delivery increments `totalSold` (and `earlyBirdSold` for early-bird tier)
- [ ] Same `session_id` delivered twice does not double-count (`processedSessionIds`)
- [ ] Opening `/meetup` or create-checkout does **not** reduce early-bird availability
- [ ] `ticket-status` reflects availability only after paid webhook / sold counts change

## Tier switch

- [ ] After **10** paid early-bird sales: tier `standard`, UI **45 €**
- [ ] Next `create-checkout` uses the standard price ID
- [ ] After `totalSold` reaches capacity: `409 sold_out`

## Mobile

- [ ] Price, early-bird status, and inline checkout stack clearly on a phone-width screen
- [ ] Thank-you state remains readable on mobile

## Done when

1. One full purchase completes on `/meetup`
2. Webhook updates inventory
3. Early-bird → standard switch is verified (or simulated by editing sold counts carefully in `inventory.json` for a dry run)
