<?php
/**
 * MailerLite helper for meetup attendee sync (operational group only).
 */

declare(strict_types=1);

function meetup_mailerlite_configured(array $config): bool
{
    return trim((string) ($config['mailer_lite_api_token'] ?? '')) !== ''
        && trim((string) ($config['mailer_lite_group_id'] ?? '')) !== '';
}

/**
 * Upsert subscriber and add to the meetup attendees group.
 *
 * MailerLite docs: POST /api/subscribers is create/update and non-destructive —
 * omitting groups/fields does not remove existing ones; listing a group only adds it.
 *
 * Ticket purchase is enough to be on the operational attendees list, so we send
 * resubscribe=true. Without it, MailerLite returns 422 for previously unsubscribed
 * contacts and never adds them to the meetup group.
 *
 * @return array{ok:bool, skipped?:bool, reason?:string, http_status?:int}
 */
function meetup_mailerlite_sync_attendee(array $config, string $email, ?string $fullName): array
{
    $email = trim($email);
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'skipped' => true, 'reason' => 'invalid_email'];
    }

    if (!meetup_mailerlite_configured($config)) {
        return ['ok' => false, 'skipped' => true, 'reason' => 'mailerlite_not_configured'];
    }

    $token = trim((string) $config['mailer_lite_api_token']);
    $groupId = trim((string) $config['mailer_lite_group_id']);

    $payload = [
        'email' => $email,
        'groups' => [$groupId],
        // Required for previously unsubscribed contacts (operational meetup group).
        'resubscribe' => true,
    ];

    $fullName = $fullName !== null ? trim($fullName) : '';
    if ($fullName !== '') {
        // Standard MailerLite field; store full attendee name as provided by Stripe.
        $payload['fields'] = [
            'name' => $fullName,
        ];
    }

    $ch = curl_init('https://connect.mailerlite.com/api/subscribers');
    if ($ch === false) {
        error_log('meetup mailerlite sync: curl_init failed for ' . $email);
        return ['ok' => false, 'reason' => 'curl_init_failed'];
    }

    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        error_log('meetup mailerlite sync: json_encode failed for ' . $email);
        return ['ok' => false, 'reason' => 'json_encode_failed'];
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $token,
        ],
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($response)) {
        error_log('meetup mailerlite sync: request failed for ' . $email . ' errno=' . $errno);
        return ['ok' => false, 'reason' => 'request_failed', 'http_status' => $status];
    }

    // 200 update / 201 create are both success for upsert.
    if ($status < 200 || $status >= 300) {
        $snippet = substr($response, 0, 300);
        error_log(
            'meetup mailerlite sync: HTTP ' . $status . ' for ' . $email . ' body=' . $snippet
        );
        return ['ok' => false, 'reason' => 'http_error', 'http_status' => $status];
    }

    return ['ok' => true, 'http_status' => $status];
}
