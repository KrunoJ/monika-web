<?php
/**
 * Example local config for meetup ticket API.
 * Copy to config.local.php (gitignored) and fill in test/live values.
 */
declare(strict_types=1);

return [
    // Stripe keys (test first)
    'stripe_secret_key' => '',
    'stripe_publishable_key' => '',
    'stripe_webhook_secret' => '',

    // Price IDs from Stripe Dashboard (two products)
    'stripe_price_early_bird' => '',
    'stripe_price_standard' => '',

    // Optional hard-coded origin for return_url (otherwise derived from request)
    'site_origin' => 'https://monikajagic.com',
];
