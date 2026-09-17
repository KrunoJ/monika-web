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

$reservationId = null;

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

    // Reserve under lock before creating the Stripe session to reduce oversell.
    $selection = meetup_inventory_reserve_seat($config);
    if ($selection === null) {
        meetup_api_json_response(['error' => 'sold_out'], 409);
    }
    $reservationId = (string) $selection['reservationId'];

    $origin = meetup_api_request_origin($config);
    $returnUrl = $origin . '/meetup/?checkout=success&session_id={CHECKOUT_SESSION_ID}#prijava';

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
            'reservation_id' => $reservationId,
        ],
        // Do not pass payment_method_types - use Dashboard dynamic methods.
    ]);

    $clientSecret = (string) ($session['client_secret'] ?? '');
    $sessionId = (string) ($session['id'] ?? '');
    if ($clientSecret === '' || $sessionId === '') {
        if ($reservationId !== null) {
            meetup_inventory_release_reservation($reservationId, null);
        }
        meetup_api_json_response(['error' => 'missing_client_secret'], 502);
    }

    meetup_inventory_attach_session($reservationId, $sessionId);

    meetup_api_json_response([
        'clientSecret' => $clientSecret,
        'publishableKey' => (string) $config['stripe_publishable_key'],
        'tier' => $selection['tier'],
        'unitAmount' => $selection['unitAmount'],
        'reservationId' => $reservationId,
    ]);
} catch (Throwable $e) {
    if (is_string($reservationId) && $reservationId !== '') {
        try {
            meetup_inventory_release_reservation($reservationId, null);
        } catch (Throwable $ignored) {
            /* ignore release errors */
        }
    }

    $code = (int) $e->getCode();
    error_log('meetup create-checkout stripe error: ' . $e->getMessage());
    if ($code >= 400 && $code < 600) {
        meetup_api_json_response([
            'error' => 'stripe_error',
        ], $code);
    }
    meetup_api_json_response(['error' => 'checkout_failed'], 500);
}
