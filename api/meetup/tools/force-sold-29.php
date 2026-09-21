<?php
declare(strict_types=1);

/**
 * ONE-SHOT: set meetup inventory to 29 sold / 10 early bird.
 * Disabled after first successful run via guard file.
 */

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/inventory.php';
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

$guard = __DIR__ . '/../data/.force-sold-29-done';
if (is_file($guard)) {
    meetup_api_json_response(['error' => 'already_applied', 'hint' => 'one-shot already used'], 410);
}

$key = (string) ($_GET['key'] ?? $_POST['key'] ?? '');
$keyFile = __DIR__ . '/force-sold-29.key';
$expected = is_file($keyFile) ? trim((string) file_get_contents($keyFile)) : '';
if ($expected === '' || $key === '' || !hash_equals($expected, $key)) {
    meetup_api_json_response(['error' => 'unauthorized'], 401);
}

$before = meetup_inventory_read();
$next = meetup_inventory_normalize($before);
$next['earlyBirdSold'] = 10;
$next['totalSold'] = 29;
$next['earlyBirdTotal'] = 10;
$next['capacityTotal'] = 30;
$next['source'] = 'manual-force-sold-29';
$next['reservations'] = [];
$next['reservedEarlyBird'] = 0;
$next['reservedStandard'] = 0;
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
