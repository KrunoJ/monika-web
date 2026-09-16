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

    $inventory = meetup_inventory_read();
    $selection = meetup_inventory_select_price($inventory, $config);
    if ($selection === null) {
        meetup_api_json_response(['error' => 'sold_out'], 409);
    }

    if (!meetup_api_stripe_configured($config)) {
        // Frontend shows a discreet offline message on non-OK responses.
        meetup_api_json_response(['error' => 'checkout_unavailable'], 503);
    }

    if ($selection['priceId'] === '') {
        meetup_api_json_response(['error' => 'checkout_unavailable'], 503);
    }

    $origin = meetup_api_request_origin($config);
    $returnUrl = $origin . '/meetup/?checkout=success&session_id={CHECKOUT_SESSION_ID}#prijava';

    $session = meetup_api_stripe_request($config['stripe_secret_key'], 'checkout/sessions', [
        'mode' => 'payment',
        'ui_mode' => 'embedded',
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
        // Do not pass payment_method_types - use Dashboard dynamic methods.
    ]);

    $clientSecret = (string) ($session['client_secret'] ?? '');
    if ($clientSecret === '') {
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
    if ($code >= 400 && $code < 600) {
        meetup_api_json_response([
            'error' => 'stripe_error',
            'message' => $e->getMessage(),
        ], $code);
    }
    meetup_api_json_response(['error' => 'checkout_failed'], 500);
}
