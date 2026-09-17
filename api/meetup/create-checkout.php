<?php
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/inventory.php';
require __DIR__ . '/lib/http.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

try {
    $config = meetup_api_load_config();
    $body = meetup_api_read_json_body();
    $quantity = (int) ($body['quantity'] ?? 1);
    if ($quantity !== 1) {
        meetup_api_json_response(['error' => 'quantity_must_be_1'], 400);
    }

    if (!meetup_api_stripe_configured($config)) {
        meetup_api_json_response(['error' => 'checkout_unavailable'], 503);
    }

    // Sold-only inventory: no soft-hold. Seat counts increase on paid webhook.
    $selection = meetup_inventory_select_offer($config);
    if ($selection === null) {
        meetup_api_json_response(['error' => 'sold_out'], 409);
    }

    $origin = meetup_api_request_origin($config);
    $returnUrl = $origin . '/meetup/hvala/?session_id={CHECKOUT_SESSION_ID}';

    $session = meetup_api_stripe_request($config['stripe_secret_key'], 'checkout/sessions', [
        'mode' => 'payment',
        'ui_mode' => 'embedded_page',
        'return_url' => $returnUrl,
        'line_items' => [
            [
                'price' => $selection['priceId'],
                'quantity' => 1,
            ],
        ],
        'metadata' => [
            'meetup' => 'ostani-u-kontaktu',
            'tier' => $selection['tier'],
        ],
        // Required attendee/buyer full name (native Stripe field, not a custom field).
        // Booleans as strings: http_build_query would otherwise send 1/0, which Stripe rejects.
        'name_collection' => [
            'individual' => [
                'enabled' => 'true',
                'optional' => 'false',
            ],
        ],
        // Session branding for embedded_page (Brick/cream meetup offer).
        // Stripe accepts only these fields — not text color, font size, or spacing.
        'branding_settings' => [
            'background_color' => '#f2e5d5',
            'button_color' => '#a45f43',
            'font_family' => 'inter',
            'border_style' => 'rounded',
        ],
        // Do not pass payment_method_types - use Dashboard dynamic methods.
    ]);

    $clientSecret = (string) ($session['client_secret'] ?? '');
    $sessionId = (string) ($session['id'] ?? '');
    if ($clientSecret === '' || $sessionId === '') {
        meetup_api_json_response(['error' => 'missing_client_secret'], 502);
    }

    meetup_api_json_response([
        'clientSecret' => $clientSecret,
        'publishableKey' => (string) $config['stripe_publishable_key'],
        'tier' => $selection['tier'],
        'unitAmount' => $selection['unitAmount'],
    ]);
} catch (Throwable $e) {
    $code = (int) $e->getCode();
    error_log('meetup create-checkout stripe error: ' . $e->getMessage());
    if ($code >= 400 && $code < 600) {
        meetup_api_json_response([
            'error' => 'stripe_error',
        ], $code);
    }
    meetup_api_json_response(['error' => 'checkout_failed'], 500);
}
