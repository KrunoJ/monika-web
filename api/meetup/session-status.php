<?php
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/http.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

$sessionId = trim((string) ($_GET['session_id'] ?? ''));
if ($sessionId === '' || !preg_match('/^cs_[A-Za-z0-9_]+$/', $sessionId)) {
    meetup_api_json_response(['error' => 'invalid_session_id'], 400);
}

$config = meetup_api_load_config();
$secret = (string) ($config['stripe_secret_key'] ?? '');
if ($secret === '') {
    meetup_api_json_response(['error' => 'checkout_unavailable'], 503);
}

try {
    $session = meetup_api_stripe_request(
        $secret,
        'checkout/sessions/' . rawurlencode($sessionId),
        [],
        'GET'
    );

    $paymentStatus = (string) ($session['payment_status'] ?? '');
    $status = (string) ($session['status'] ?? '');
    $metadata = is_array($session['metadata'] ?? null) ? $session['metadata'] : [];
    $tier = (string) ($metadata['tier'] ?? '');
    if ($tier !== 'early_bird' && $tier !== 'standard') {
        $tier = null;
    }

    $paid = ($paymentStatus === 'paid' || $paymentStatus === 'no_payment_required');

    meetup_api_json_response([
        'ok' => true,
        'paid' => $paid,
        'status' => $status,
        'payment_status' => $paymentStatus,
        'tier' => $tier,
        'session_id' => $sessionId,
    ]);
} catch (Throwable $e) {
    $code = (int) $e->getCode();
    error_log('meetup session-status stripe error: ' . $e->getMessage());
    if ($code === 404) {
        meetup_api_json_response([
            'ok' => false,
            'paid' => false,
            'error' => 'session_not_found',
        ], 404);
    }
    if ($code >= 400 && $code < 600) {
        meetup_api_json_response([
            'ok' => false,
            'paid' => false,
            'error' => 'stripe_error',
        ], $code);
    }
    meetup_api_json_response([
        'ok' => false,
        'paid' => false,
        'error' => 'session_status_failed',
    ], 500);
}
