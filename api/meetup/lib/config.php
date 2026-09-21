<?php
/**
 * Meetup ticket API - shared config.
 *
 * Copy config.example.php to config.local.php and fill values,
 * or set the listed environment variables on the host.
 */

declare(strict_types=1);

function meetup_api_load_config(): array
{
    $defaults = [
        'stripe_secret_key' => '',
        'stripe_publishable_key' => '',
        'stripe_webhook_secret' => '',
        'stripe_price_early_bird' => '',
        'stripe_price_standard' => '',
        'site_origin' => '',
        'mailer_lite_api_token' => '',
        'mailer_lite_group_id' => '',
        'currency' => 'eur',
        'early_bird_amount' => 2900,
        'standard_amount' => 4500,
        // Organizer sale notify (authenticated SMTP; host-only secrets)
        'organizer_notify_to' => '',
        'organizer_notify_from' => '',
        'organizer_notify_from_name' => 'OSTANI U KONTAKTU.',
        'smtp_host' => '',
        'smtp_port' => 465,
        'smtp_username' => '',
        'smtp_password' => '',
        'smtp_encryption' => 'ssl',
    ];

    $localFile = __DIR__ . '/../config.local.php';
    $local = [];
    if (is_file($localFile)) {
        $loaded = require $localFile;
        if (is_array($loaded)) {
            $local = $loaded;
        }
    }

    $envMap = [
        'stripe_secret_key' => 'STRIPE_SECRET_KEY',
        'stripe_publishable_key' => 'STRIPE_PUBLISHABLE_KEY',
        'stripe_webhook_secret' => 'STRIPE_WEBHOOK_SECRET',
        'stripe_price_early_bird' => 'STRIPE_PRICE_EARLY_BIRD',
        'stripe_price_standard' => 'STRIPE_PRICE_STANDARD',
        'site_origin' => 'SITE_ORIGIN',
        'mailer_lite_api_token' => 'MAILER_LITE_API_TOKEN',
        'mailer_lite_group_id' => 'MAILER_LITE_GROUP_ID',
        'organizer_notify_to' => 'MEETUP_ORGANIZER_NOTIFY_TO',
        'organizer_notify_from' => 'MEETUP_ORGANIZER_NOTIFY_FROM',
        'organizer_notify_from_name' => 'MEETUP_ORGANIZER_NOTIFY_FROM_NAME',
        'smtp_host' => 'MEETUP_SMTP_HOST',
        'smtp_port' => 'MEETUP_SMTP_PORT',
        'smtp_username' => 'MEETUP_SMTP_USERNAME',
        'smtp_password' => 'MEETUP_SMTP_PASSWORD',
        'smtp_encryption' => 'MEETUP_SMTP_ENCRYPTION',
    ];

    $config = array_merge($defaults, $local);
    foreach ($envMap as $key => $envName) {
        $value = getenv($envName);
        if (is_string($value) && $value !== '') {
            if ($key === 'smtp_port') {
                $config[$key] = (int) $value;
            } else {
                $config[$key] = $value;
            }
        }
    }

    return $config;
}

function meetup_api_request_origin(array $config): string
{
    if (!empty($config['site_origin'])) {
        return rtrim((string) $config['site_origin'], '/');
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ((string) ($_SERVER['SERVER_PORT'] ?? '') === '443')
        || ((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    return $scheme . '://' . $host;
}

function meetup_api_stripe_configured(array $config): bool
{
    return $config['stripe_secret_key'] !== ''
        && $config['stripe_publishable_key'] !== ''
        && $config['stripe_price_early_bird'] !== ''
        && $config['stripe_price_standard'] !== '';
}
