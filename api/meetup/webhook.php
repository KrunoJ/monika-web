<?php
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/inventory.php';
require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/mailerlite.php';
require __DIR__ . '/lib/notify.php';

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

// Expired / abandoned checkouts: no soft-hold to release (legacy rows cleaned if present).
if ($type === 'checkout.session.expired') {
    $released = false;
    if ($reservationId !== '' || $sessionId !== '') {
        $released = meetup_inventory_release_reservation(
            $reservationId !== '' ? $reservationId : null,
            $sessionId !== '' ? $sessionId : null
        );
    }
    meetup_api_json_response([
        'received' => true,
        'handled' => $released ? 'reservation_released' : 'ignored_expired',
        'session_id' => $sessionId,
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

    // Secondary: sync attendee to MailerLite meetup group.
    // Runs after inventory (incl. duplicate retries) so Stripe remains source of truth.
    // MailerLite upsert is non-destructive and safe to repeat for the same email/group.
    $customerDetails = is_array($session['customer_details'] ?? null)
        ? $session['customer_details']
        : [];
    $email = trim((string) ($customerDetails['email'] ?? ''));
    $individualName = trim((string) ($customerDetails['individual_name'] ?? ''));
    $mailerlite = ['ok' => false, 'skipped' => true, 'reason' => 'missing_email'];
    if ($email !== '') {
        try {
            $mailerlite = meetup_mailerlite_sync_attendee(
                $config,
                $email,
                $individualName !== '' ? $individualName : null
            );
        } catch (Throwable $mlError) {
            error_log(
                'meetup mailerlite sync exception for session ' . $sessionId
                . ': ' . $mlError->getMessage()
            );
            $mailerlite = ['ok' => false, 'reason' => 'exception'];
        }
    }

    // Tertiary: organizer email for newly applied paid sales only (never on Stripe retries).
    // Non-critical: failures are logged and never fail inventory or MailerLite.
    $notify = ['ok' => false, 'skipped' => true, 'reason' => 'not_new_sale'];
    if (!empty($result['applied'])) {
        try {
            $amountTotal = (int) ($session['amount_total'] ?? 0);
            $notify = meetup_notify_organizer_sale($config, [
                'buyer_name' => $individualName,
                'buyer_email' => $email,
                'tier' => $tier,
                'amount_total' => $amountTotal,
                'total_sold' => (int) ($status['totalSold'] ?? 0),
                'capacity_total' => (int) ($status['capacityTotal'] ?? 30),
                'early_bird_sold' => (int) ($status['earlyBirdSold'] ?? 0),
                'early_bird_total' => (int) ($status['earlyBirdTotal'] ?? 10),
                'session_id' => $sessionId,
            ]);
        } catch (Throwable $notifyError) {
            error_log(
                'meetup organizer notify exception for session ' . $sessionId
                . ': ' . $notifyError->getMessage()
            );
            $notify = ['ok' => false, 'reason' => 'exception'];
        }
    }

    meetup_api_json_response([
        'received' => true,
        'handled' => $result['duplicate'] ? 'duplicate' : 'sale_recorded',
        'tier' => $tier,
        'session_id' => $sessionId,
        'reservation_id' => $reservationId !== '' ? $reservationId : null,
        'earlyBirdAvailable' => $status['earlyBirdAvailable'],
        'currentTier' => $status['currentTier'],
        'totalSold' => $status['totalSold'],
        'mailerlite' => [
            'ok' => (bool) ($mailerlite['ok'] ?? false),
            'skipped' => (bool) ($mailerlite['skipped'] ?? false),
            'reason' => $mailerlite['reason'] ?? null,
        ],
        'organizer_notify' => [
            'ok' => (bool) ($notify['ok'] ?? false),
            'skipped' => (bool) ($notify['skipped'] ?? false),
            'reason' => $notify['reason'] ?? null,
        ],
    ]);
} catch (Throwable $e) {
    meetup_api_json_response(['error' => 'inventory_update_failed'], 500);
}
