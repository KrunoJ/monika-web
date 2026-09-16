<?php
declare(strict_types=1);

function meetup_api_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function meetup_api_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function meetup_api_stripe_request(string $secretKey, string $path, array $params): array
{
    $ch = curl_init('https://api.stripe.com/v1/' . ltrim($path, '/'));
    if ($ch === false) {
        throw new RuntimeException('curl_init failed');
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $secretKey . ':',
        CURLOPT_POSTFIELDS => http_build_query($params),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
            'Stripe-Version: 2025-03-31.basil',
        ],
    ]);

    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($body)) {
        throw new RuntimeException('Stripe request failed');
    }

    $json = json_decode($body, true);
    if (!is_array($json)) {
        throw new RuntimeException('Invalid Stripe response');
    }

    if ($status < 200 || $status >= 300) {
        $message = (string) ($json['error']['message'] ?? 'Stripe error');
        throw new RuntimeException($message, $status);
    }

    return $json;
}
