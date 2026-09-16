<?php
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/inventory.php';
require __DIR__ . '/lib/http.php';

/**
 * Verify Stripe-Signature header (webhook signing secret).
 */
function meetup_api_verify_stripe_webhook(string $payload, string $sigHeader, string $secret, int $toleranceSec = 300): bool
{
    if ($payload === '' || $sigHeader === '' || $secret === '') {
        return false;
    }

    $parts = [];
    foreach (explode(',', $sigHeader) as $item) {
        $item = trim($item);
        if ($item === '' || !str_contains($item, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $item, 2);
        $parts[$k][] = $v;
    }

    $timestamp = isset($parts['t'][0]) ? (int) $parts['t'][0] : 0;
    $signatures = $parts['v1'] ?? [];
    if ($timestamp <= 0 || $signatures === []) {
        return false;
    }

    if (abs(time() - $timestamp) > $toleranceSec) {
        return false;
    }

    $signedPayload = $timestamp . '.' . $payload;
    $expected = hash_hmac('sha256', $signedPayload, $secret);

    foreach ($signatures as $signature) {
        if (hash_equals($expected, $signature)) {
            return true;
        }
    }

    return false;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

$config = meetup_api_load_config();
$secret = (string) ($config['stripe_webhook_secret'] ?? '');
if ($secret === '') {
    meetup_api_json_response(['error' => 'webhook_not_configured'], 503);
}

$payload = file_get_contents('php://input');
if (!is_string($payload) || $payload === '') {
    meetup_api_json_response(['error' => 'empty_payload'], 400);
}

$sigHeader = (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');
if (!meetup_api_verify_stripe_webhook($payload, $sigHeader, $secret)) {
    meetup_api_json_response(['error' => 'invalid_signature'], 400);
}

$event = json_decode($payload, true);
if (!is_array($event) || !isset($event['type'])) {
    meetup_api_json_response(['error' => 'invalid_event'], 400);
}

$type = (string) $event['type'];
$session = $event['data']['object'] ?? null;
if (!is_array($session)) {
    // Some ignored event types may still lack an object; acknowledge safely.
    if ($type !== 'checkout.session.completed' && $type !== 'checkout.session.expired') {
        meetup_api_json_response(['received' => true, 'handled' => 'ignored']);
    }
    meetup_api_json_response(['error' => 'missing_session'], 400);
}

$sessionId = (string) ($session['id'] ?? '');
$metadata = is_array($session['metadata'] ?? null) ? $session['metadata'] : [];
$reservationId = (string) ($metadata['reservation_id'] ?? '');
$tier = (string) ($metadata['tier'] ?? '');

// Expired / abandoned checkouts free the reservation without incrementing sold.
if ($type === 'checkout.session.expired') {
    $released = meetup_inventory_release_reservation(
        $reservationId !== '' ? $reservationId : null,
        $sessionId !== '' ? $sessionId : null
    );
    meetup_api_json_response([
        'received' => true,
        'handled' => $released ? 'reservation_released' : 'ignored_expired',
        'session_id' => $sessionId,
        'reservation_id' => $reservationId !== '' ? $reservationId : null,
    ]);
}

if ($type !== 'checkout.session.completed') {
    meetup_api_json_response(['received' => true, 'handled' => 'ignored']);
}

$paymentStatus = (string) ($session['payment_status'] ?? '');

// Only count paid (or no_payment_required) sessions.
if ($paymentStatus !== 'paid' && $paymentStatus !== 'no_payment_required') {
    meetup_api_json_response([
        'received' => true,
        'handled' => 'ignored_unpaid',
        'payment_status' => $paymentStatus,
    ]);
}

if ($tier !== 'early_bird' && $tier !== 'standard') {
    $inventory = meetup_inventory_read();
    $status = meetup_inventory_status($inventory, $config);
    $tier = $status['earlyBirdAvailable'] > 0 ? 'early_bird' : 'standard';
}

try {
    $result = meetup_inventory_apply_sale(
        $sessionId,
        $tier,
        1,
        $reservationId !== '' ? $reservationId : null
    );
    $status = meetup_inventory_status($result['inventory'], $config);

    meetup_api_json_response([
        'received' => true,
        'handled' => $result['duplicate'] ? 'duplicate' : 'sale_recorded',
        'tier' => $tier,
        'session_id' => $sessionId,
        'reservation_id' => $reservationId !== '' ? $reservationId : null,
        'earlyBirdAvailable' => $status['earlyBirdAvailable'],
        'currentTier' => $status['currentTier'],
        'totalSold' => $status['totalSold'],
    ]);
} catch (Throwable $e) {
    meetup_api_json_response(['error' => 'inventory_update_failed'], 500);
}
