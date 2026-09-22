<?php
declare(strict_types=1);

/**
 * ONE-SHOT: reset meetup inventory to 0 sold / full early bird availability.
 * Disabled after first successful run via guard file.
 */

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/inventory.php';
require __DIR__ . '/../lib/http.php';

if (['REQUEST_METHOD'] !== 'POST' && ['REQUEST_METHOD'] !== 'GET') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

 = __DIR__ . '/../data/.force-reset-sold-0-done';
if (is_file()) {
    meetup_api_json_response(['error' => 'already_applied', 'hint' => 'one-shot already used'], 410);
}

 = (string) (['key'] ?? ['key'] ?? '');
 = '7a05a0b3fef3208932b531d006dde3c1e6d7042ba62a5444';
if ( === '' || !hash_equals(, )) {
    meetup_api_json_response(['error' => 'unauthorized'], 401);
}

 = meetup_inventory_read();
 = meetup_inventory_default();
['source'] = 'manual-reset-sold-0';
meetup_inventory_write();

@file_put_contents(, gmdate('c') . "
");

 = meetup_inventory_status(, meetup_api_load_config());
meetup_api_json_response([
    'ok' => true,
    'before' => [
        'earlyBirdSold' => (int) (['earlyBirdSold'] ?? 0),
        'totalSold' => (int) (['totalSold'] ?? 0),
    ],
    'after' => [
        'earlyBirdSold' => (int) ['earlyBirdSold'],
        'totalSold' => (int) ['totalSold'],
        'earlyBirdAvailable' => (int) ['earlyBirdAvailable'],
        'currentTier' => ['currentTier'],
        'unitAmount' => (int) ['unitAmount'],
    ],
]);
