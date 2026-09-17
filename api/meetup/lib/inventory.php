<?php
/**
 * Meetup ticket inventory store (paid sales only).
 *
 * Default seed starts at zero sold. Soft-hold reservations are not used;
 * availability is derived from paid webhook increments.
 */

declare(strict_types=1);

function meetup_inventory_path(): string
{
    return __DIR__ . '/../data/inventory.json';
}

function meetup_inventory_reservation_ttl_seconds(): int
{
    return 30 * 60;
}

function meetup_inventory_default(): array
{
    return [
        'earlyBirdTotal' => 10,
        'earlyBirdSold' => 0,
        'capacityTotal' => 30,
        'totalSold' => 0,
        'currency' => 'eur',
        'updatedAt' => gmdate('c'),
        'source' => 'live-ready',
        'processedSessionIds' => [],
        'reservations' => [],
        'reservedEarlyBird' => 0,
        'reservedStandard' => 0,
    ];
}

function meetup_inventory_normalize(array $data): array
{
    $merged = array_merge(meetup_inventory_default(), $data);
    if (!isset($merged['processedSessionIds']) || !is_array($merged['processedSessionIds'])) {
        $merged['processedSessionIds'] = [];
    }
    if (!isset($merged['reservations']) || !is_array($merged['reservations'])) {
        $merged['reservations'] = [];
    }
    $merged['reservedEarlyBird'] = (int) ($merged['reservedEarlyBird'] ?? 0);
    $merged['reservedStandard'] = (int) ($merged['reservedStandard'] ?? 0);
    return $merged;
}

function meetup_inventory_write_unlocked($fh, array $inventory): array
{
    $inventory = meetup_inventory_normalize($inventory);
    $inventory['updatedAt'] = gmdate('c');
    $json = json_encode($inventory, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Failed to encode inventory');
    }
    ftruncate($fh, 0);
    rewind($fh);
    if (fwrite($fh, $json . "\n") === false) {
        throw new RuntimeException('Failed to write inventory');
    }
    fflush($fh);
    return $inventory;
}

/**
 * @template T
 * @param callable(array):array{0:T,1:array} $fn
 * @return T
 */
function meetup_inventory_with_lock(callable $fn)
{
    $path = meetup_inventory_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    if (!is_file($path)) {
        meetup_inventory_write(meetup_inventory_default());
    }

    $fh = fopen($path, 'c+');
    if ($fh === false) {
        throw new RuntimeException('Failed to open inventory');
    }

    try {
        if (!flock($fh, LOCK_EX)) {
            throw new RuntimeException('Failed to lock inventory');
        }

        rewind($fh);
        $raw = stream_get_contents($fh);
        $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        $inventory = is_array($data) ? meetup_inventory_normalize($data) : meetup_inventory_default();
        $inventory = meetup_inventory_prune_reservations($inventory);

        [$result, $next] = $fn($inventory);
        meetup_inventory_write_unlocked($fh, $next);
        return $result;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

function meetup_inventory_read(): array
{
    $path = meetup_inventory_path();
    if (!is_file($path)) {
        $seed = meetup_inventory_default();
        meetup_inventory_write($seed);
        return $seed;
    }

    $raw = file_get_contents($path);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        return meetup_inventory_default();
    }

    return meetup_inventory_prune_reservations(meetup_inventory_normalize($data));
}

function meetup_inventory_write(array $data): void
{
    $path = meetup_inventory_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $data = meetup_inventory_normalize($data);
    $data['updatedAt'] = gmdate('c');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Failed to encode inventory');
    }

    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        throw new RuntimeException('Failed to write inventory');
    }
    rename($tmp, $path);
}

function meetup_inventory_recompute_reserved(array $inventory): array
{
    $early = 0;
    $standard = 0;
    foreach ($inventory['reservations'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $tier = (string) ($row['tier'] ?? '');
        if ($tier === 'early_bird') {
            $early++;
        } elseif ($tier === 'standard') {
            $standard++;
        }
    }
    $inventory['reservedEarlyBird'] = $early;
    $inventory['reservedStandard'] = $standard;
    return $inventory;
}

function meetup_inventory_prune_reservations(array $inventory, ?int $now = null): array
{
    $now = $now ?? time();
    $kept = [];
    foreach ($inventory['reservations'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $expiresAt = (int) ($row['expiresAt'] ?? 0);
        if ($expiresAt > 0 && $expiresAt <= $now) {
            continue;
        }
        $kept[] = $row;
    }
    $inventory['reservations'] = $kept;
    return meetup_inventory_recompute_reserved($inventory);
}

/**
 * @return array{early:int,standard:int,all:int}
 */
function meetup_inventory_reserved_counts(array $inventory): array
{
    $early = (int) ($inventory['reservedEarlyBird'] ?? 0);
    $standard = (int) ($inventory['reservedStandard'] ?? 0);
    return [
        'early' => $early,
        'standard' => $standard,
        'all' => $early + $standard,
    ];
}

/**
 * Derive public ticket status from inventory + config amounts.
 * Availability is sold-only (no soft-hold reservations).
 */
function meetup_inventory_status(array $inventory, array $config): array
{
    $inventory = meetup_inventory_prune_reservations($inventory);
    $earlyTotal = max(0, (int) ($inventory['earlyBirdTotal'] ?? 10));
    $earlySold = max(0, (int) ($inventory['earlyBirdSold'] ?? 0));
    $capacityTotal = max(0, (int) ($inventory['capacityTotal'] ?? 30));
    $totalSold = max(0, (int) ($inventory['totalSold'] ?? 0));

    if ($earlySold > $earlyTotal) {
        $earlySold = $earlyTotal;
    }
    if ($totalSold > $capacityTotal) {
        $totalSold = $capacityTotal;
    }

    $earlyAvailable = max(0, $earlyTotal - $earlySold);
    $totalAvailable = max(0, $capacityTotal - $totalSold);
    $earlyAmount = (int) ($config['early_bird_amount'] ?? 2900);
    $standardAmount = (int) ($config['standard_amount'] ?? 4500);

    if ($totalAvailable <= 0) {
        $tier = 'sold_out';
        $unitAmount = $standardAmount;
        $earlyAvailable = 0;
    } elseif ($earlyAvailable > 0) {
        $tier = 'early_bird';
        $unitAmount = $earlyAmount;
    } else {
        $tier = 'standard';
        $unitAmount = $standardAmount;
    }

    return [
        'currency' => (string) ($config['currency'] ?? 'eur'),
        'capacityTotal' => $capacityTotal,
        'earlyBirdTotal' => $earlyTotal,
        'earlyBirdAvailable' => $earlyAvailable,
        'earlyBirdSold' => $earlySold,
        'currentTier' => $tier,
        'unitAmount' => $unitAmount,
        'publishableKey' => (string) ($config['stripe_publishable_key'] ?? ''),
        'totalSold' => $totalSold,
        'reservedEarlyBird' => 0,
        'reservedStandard' => 0,
    ];
}

/**
 * Choose current tier + Stripe Price ID from sold inventory (no seat soft-hold).
 *
 * @return array{tier:string,priceId:string,unitAmount:int}|null
 */
function meetup_inventory_select_offer(array $config): ?array
{
    $inventory = meetup_inventory_read();
    $status = meetup_inventory_status($inventory, $config);
    if ($status['currentTier'] === 'sold_out') {
        return null;
    }

    $tier = $status['currentTier'];
    $priceId = $tier === 'early_bird'
        ? (string) $config['stripe_price_early_bird']
        : (string) $config['stripe_price_standard'];

    if ($priceId === '') {
        return null;
    }

    return [
        'tier' => $tier,
        'priceId' => $priceId,
        'unitAmount' => $status['unitAmount'],
    ];
}

/**
 * @deprecated Soft-hold reservations are no longer used; kept for webhook cleanup of legacy rows.
 */
function meetup_inventory_reserve_seat(array $config): ?array
{
    $offer = meetup_inventory_select_offer($config);
    if ($offer === null) {
        return null;
    }
    $offer['reservationId'] = '';
    return $offer;
}

function meetup_inventory_attach_session(string $reservationId, string $sessionId): void
{
    $reservationId = trim($reservationId);
    $sessionId = trim($sessionId);
    if ($reservationId === '' || $sessionId === '') {
        return;
    }

    meetup_inventory_with_lock(function (array $inventory) use ($reservationId, $sessionId) {
        foreach ($inventory['reservations'] as $i => $row) {
            if (!is_array($row)) {
                continue;
            }
            if ((string) ($row['id'] ?? '') !== $reservationId) {
                continue;
            }
            $inventory['reservations'][$i]['sessionId'] = $sessionId;
            break;
        }
        return [true, $inventory];
    });
}

function meetup_inventory_release_reservation(?string $reservationId = null, ?string $sessionId = null): bool
{
    $reservationId = $reservationId !== null ? trim($reservationId) : '';
    $sessionId = $sessionId !== null ? trim($sessionId) : '';
    if ($reservationId === '' && $sessionId === '') {
        return false;
    }

    return (bool) meetup_inventory_with_lock(function (array $inventory) use ($reservationId, $sessionId) {
        $before = count($inventory['reservations']);
        $kept = [];
        foreach ($inventory['reservations'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = (string) ($row['id'] ?? '');
            $sid = (string) ($row['sessionId'] ?? '');
            if ($reservationId !== '' && $id === $reservationId) {
                continue;
            }
            if ($sessionId !== '' && $sid !== '' && $sid === $sessionId) {
                continue;
            }
            $kept[] = $row;
        }
        $inventory['reservations'] = $kept;
        $inventory = meetup_inventory_recompute_reserved($inventory);
        return [count($kept) < $before, $inventory];
    });
}

/**
 * Idempotently record one paid checkout session and consume its reservation.
 *
 * @return array{applied: bool, duplicate: bool, inventory: array}
 */
function meetup_inventory_apply_sale(
    string $sessionId,
    string $tier,
    int $quantity = 1,
    ?string $reservationId = null
): array {
    $sessionId = trim($sessionId);
    $tier = trim($tier);
    $quantity = max(1, $quantity);
    $reservationId = $reservationId !== null ? trim($reservationId) : '';

    if ($sessionId === '') {
        throw new InvalidArgumentException('missing_session_id');
    }

    return meetup_inventory_with_lock(function (array $inventory) use ($sessionId, $tier, $quantity, $reservationId) {
        $processed = $inventory['processedSessionIds'];
        if (in_array($sessionId, $processed, true)) {
            // Still drop any lingering reservation for this session.
            $inventory = meetup_inventory_drop_reservation_rows($inventory, $reservationId, $sessionId);
            return [[
                'applied' => false,
                'duplicate' => true,
                'inventory' => $inventory,
            ], $inventory];
        }

        $earlyTotal = max(0, (int) $inventory['earlyBirdTotal']);
        $capacityTotal = max(0, (int) $inventory['capacityTotal']);
        $earlySold = max(0, (int) $inventory['earlyBirdSold']);
        $totalSold = max(0, (int) $inventory['totalSold']);

        if ($tier === 'early_bird') {
            $earlySold = min($earlyTotal, $earlySold + $quantity);
        }

        $totalSold = min($capacityTotal, $totalSold + $quantity);
        $processed[] = $sessionId;
        if (count($processed) > 500) {
            $processed = array_slice($processed, -500);
        }

        $inventory['earlyBirdSold'] = $earlySold;
        $inventory['totalSold'] = $totalSold;
        $inventory['processedSessionIds'] = array_values($processed);
        $inventory['source'] = 'stripe-webhook';
        $inventory = meetup_inventory_drop_reservation_rows($inventory, $reservationId, $sessionId);

        return [[
            'applied' => true,
            'duplicate' => false,
            'inventory' => $inventory,
        ], $inventory];
    });
}

function meetup_inventory_drop_reservation_rows(
    array $inventory,
    string $reservationId,
    string $sessionId
): array {
    $kept = [];
    foreach ($inventory['reservations'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $id = (string) ($row['id'] ?? '');
        $sid = (string) ($row['sessionId'] ?? '');
        if ($reservationId !== '' && $id === $reservationId) {
            continue;
        }
        if ($sessionId !== '' && $sid !== '' && $sid === $sessionId) {
            continue;
        }
        $kept[] = $row;
    }
    $inventory['reservations'] = $kept;
    return meetup_inventory_recompute_reserved($inventory);
}
