<?php
/**
 * Meetup ticket inventory store.
 *
 * Seed values below are MOCK until go-live. After real sales start, reset
 * earlyBirdSold/totalSold to match Stripe (or 0) and let webhooks own updates.
 * Do not treat mock seed as live ticket sales.
 */

declare(strict_types=1);

function meetup_inventory_path(): string
{
    return __DIR__ . '/../data/inventory.json';
}

function meetup_inventory_default(): array
{
    return [
        'earlyBirdTotal' => 10,
        // MOCK seed - replace/reset at go-live before trusting counts
        'earlyBirdSold' => 3,
        'capacityTotal' => 30,
        'totalSold' => 3,
        'currency' => 'eur',
        'updatedAt' => gmdate('c'),
        'source' => 'mock-placeholder',
        'processedSessionIds' => [],
    ];
}

function meetup_inventory_normalize(array $data): array
{
    $merged = array_merge(meetup_inventory_default(), $data);
    if (!isset($merged['processedSessionIds']) || !is_array($merged['processedSessionIds'])) {
        $merged['processedSessionIds'] = [];
    }
    return $merged;
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

    return meetup_inventory_normalize($data);
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

/**
 * Idempotently record one paid checkout session.
 *
 * @return array{applied: bool, duplicate: bool, inventory: array}
 */
function meetup_inventory_apply_sale(string $sessionId, string $tier, int $quantity = 1): array
{
    $sessionId = trim($sessionId);
    $tier = trim($tier);
    $quantity = max(1, $quantity);

    if ($sessionId === '') {
        throw new InvalidArgumentException('missing_session_id');
    }

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

        $processed = $inventory['processedSessionIds'];
        if (in_array($sessionId, $processed, true)) {
            return [
                'applied' => false,
                'duplicate' => true,
                'inventory' => $inventory,
            ];
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

        // Keep processed list bounded
        if (count($processed) > 500) {
            $processed = array_slice($processed, -500);
        }

        $inventory['earlyBirdSold'] = $earlySold;
        $inventory['totalSold'] = $totalSold;
        $inventory['processedSessionIds'] = array_values($processed);
        $inventory['source'] = 'stripe-webhook';
        $inventory['updatedAt'] = gmdate('c');

        $json = json_encode($inventory, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Failed to encode inventory');
        }

        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, $json . "\n");
        fflush($fh);

        return [
            'applied' => true,
            'duplicate' => false,
            'inventory' => $inventory,
        ];
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/**
 * Derive public ticket status from inventory + config amounts.
 *
 * @return array{
 *   currency: string,
 *   capacityTotal: int,
 *   earlyBirdTotal: int,
 *   earlyBirdAvailable: int,
 *   earlyBirdSold: int,
 *   currentTier: string,
 *   unitAmount: int,
 *   publishableKey: string,
 *   totalSold: int
 * }
 */
function meetup_inventory_status(array $inventory, array $config): array
{
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
    $earlyAmount = (int) ($config['early_bird_amount'] ?? 2900);
    $standardAmount = (int) ($config['standard_amount'] ?? 4500);

    if ($earlyAvailable > 0) {
        $tier = 'early_bird';
        $unitAmount = $earlyAmount;
    } elseif ($totalSold < $capacityTotal) {
        $tier = 'standard';
        $unitAmount = $standardAmount;
    } else {
        $tier = 'sold_out';
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
    ];
}

/**
 * Choose price id + tier for the next ticket without mutating inventory.
 *
 * @return array{tier: string, priceId: string, unitAmount: int}|null null when sold out
 */
function meetup_inventory_select_price(array $inventory, array $config): ?array
{
    $status = meetup_inventory_status($inventory, $config);
    if ($status['currentTier'] === 'sold_out') {
        return null;
    }

    if ($status['currentTier'] === 'early_bird') {
        return [
            'tier' => 'early_bird',
            'priceId' => (string) $config['stripe_price_early_bird'],
            'unitAmount' => $status['unitAmount'],
        ];
    }

    return [
        'tier' => 'standard',
        'priceId' => (string) $config['stripe_price_standard'],
        'unitAmount' => $status['unitAmount'],
    ];
}
