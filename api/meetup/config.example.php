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

    // MailerLite — meetup attendees group only (not the regular newsletter)
    'mailer_lite_api_token' => '',
    'mailer_lite_group_id' => '198801508107551922',

    // Organizer sale notification via authenticated SMTP (any provider; no mail() fallback).
    // Fill non-secret values here as hints; put real credentials only in config.local.php
    // on the server (gitignored). Never commit smtp_password.
    'organizer_notify_to' => 'monika@monikajagic.com',
    'organizer_notify_from' => 'monika@monikajagic.com',
    'organizer_notify_from_name' => 'OSTANI U KONTAKTU.',
    'smtp_host' => 'mail.monikajagic.com',
    'smtp_port' => 465,
    'smtp_username' => 'monika@monikajagic.com',
    'smtp_password' => '', // set only in config.local.php on the host
    'smtp_encryption' => 'ssl', // ssl (465) or tls (587 STARTTLS)
];
