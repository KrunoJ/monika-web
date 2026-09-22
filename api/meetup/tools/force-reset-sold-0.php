<?php
declare(strict_types=1);

/**
 * ONE-SHOT: reset meetup inventory to 0 sold / full early bird availability.
 * Disabled after first successful run via guard file.
 */

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/inventory.php';
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

$guard = __DIR__ . '/../data/.force-reset-sold-0-done';
if (is_file($guard)) {
    meetup_api_json_response(['error' => 'already_applied', 'hint' => 'one-shot already used'], 410);
}

$key = (string) ($_GET['key'] ?? $_POST['key'] ?? '');
$keyFile = __DIR__ . '/force-reset-sold-0.key';
$expected = is_file($keyFile) ? trim((string) file_get_contents($keyFile)) : '';
if ($expected === '' || $key === '' || !hash_equals($expected, $key)) {
    meetup_api_json_response(['error' => 'unauthorized'], 401);
}

$before = meetup_inventory_read();
$next = meetup_inventory_default();
$next['source'] = 'manual-reset-sold-0';
meetup_inventory_write($next);

@file_put_contents($guard, gmdate('c') . "\n");
@unlink($keyFile);

$status = meetup_inventory_status($next, meetup_api_load_config());
meetup_api_json_response([
    'ok' => true,
    'before' => [
        'earlyBirdSold' => (int) ($before['earlyBirdSold'] ?? 0),
        'totalSold' => (int) ($before['totalSold'] ?? 0),
    ],
    'after' => [
        'earlyBirdSold' => (int) $next['earlyBirdSold'],
        'totalSold' => (int) $next['totalSold'],
        'earlyBirdAvailable' => (int) $status['earlyBirdAvailable'],
        'currentTier' => $status['currentTier'],
        'unitAmount' => (int) $status['unitAmount'],
    ],
]);
