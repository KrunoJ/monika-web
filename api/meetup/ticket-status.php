<?php
declare(strict_types=1);

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/inventory.php';
require __DIR__ . '/lib/http.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    meetup_api_json_response(['error' => 'method_not_allowed'], 405);
}

try {
    $config = meetup_api_load_config();
    $inventory = meetup_inventory_read();
    $status = meetup_inventory_status($inventory, $config);

    // Public contract expected by js/meetup-tickets.js
    meetup_api_json_response([
        'currency' => $status['currency'],
        'capacityTotal' => $status['capacityTotal'],
        'earlyBirdTotal' => $status['earlyBirdTotal'],
        'earlyBirdAvailable' => $status['earlyBirdAvailable'],
        'earlyBirdSold' => $status['earlyBirdSold'],
        'currentTier' => $status['currentTier'],
        'unitAmount' => $status['unitAmount'],
        'publishableKey' => $status['publishableKey'],
    ]);
} catch (Throwable $e) {
    meetup_api_json_response(['error' => 'ticket_status_failed'], 500);
}
