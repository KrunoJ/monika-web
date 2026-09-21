<?php
/**
 * Organizer purchase notification via authenticated SMTP (domain mailbox).
 *
 * Provider-neutral: works with any SMTP host (e.g. mail.monikajagic.com on Plus Hosting).
 * No PHP mail() fallback. Requires SMTP settings in config.local.php / env.
 * Never log smtp_password.
 */

declare(strict_types=1);

/**
 * True when recipient + SMTP auth settings are present.
 */
function meetup_notify_organizer_configured(array $config): bool
{
    return trim((string) ($config['organizer_notify_to'] ?? '')) !== ''
        && trim((string) ($config['organizer_notify_from'] ?? '')) !== ''
        && trim((string) ($config['smtp_host'] ?? '')) !== ''
        && trim((string) ($config['smtp_username'] ?? '')) !== ''
        && trim((string) ($config['smtp_password'] ?? '')) !== '';
}

/**
 * Map inventory tier to organizer-facing label.
 */
function meetup_notify_tier_label(string $tier): string
{
    return $tier === 'early_bird' ? 'Early Bird' : 'Regular';
}

/**
 * Format Stripe amount_total (cents) as EUR display amount without currency symbol.
 */
function meetup_notify_format_eur_amount(int $amountTotalCents): string
{
    $euros = $amountTotalCents / 100;
    if (abs($euros - round($euros)) < 0.00001) {
        return (string) (int) round($euros);
    }
    return number_format($euros, 2, ',', '');
}

/**
 * Send organizer notification for one newly applied paid sale.
 *
 * @param array{
 *   buyer_name?:string,
 *   buyer_email?:string,
 *   tier:string,
 *   amount_total:int,
 *   total_sold:int,
 *   capacity_total?:int,
 *   early_bird_sold:int,
 *   early_bird_total?:int,
 *   session_id?:string
 * } $sale
 * @return array{ok:bool, skipped?:bool, reason?:string}
 */
function meetup_notify_organizer_sale(array $config, array $sale): array
{
    if (!meetup_notify_organizer_configured($config)) {
        return ['ok' => false, 'skipped' => true, 'reason' => 'notify_not_configured'];
    }

    $to = trim((string) $config['organizer_notify_to']);
    $from = trim((string) $config['organizer_notify_from']);
    $fromName = trim((string) ($config['organizer_notify_from_name'] ?? 'OSTANI U KONTAKTU.'));

    $buyerName = trim((string) ($sale['buyer_name'] ?? ''));
    $buyerEmail = trim((string) ($sale['buyer_email'] ?? ''));
    $tierLabel = meetup_notify_tier_label((string) ($sale['tier'] ?? 'standard'));
    $amount = meetup_notify_format_eur_amount((int) ($sale['amount_total'] ?? 0));
    $totalSold = (int) ($sale['total_sold'] ?? 0);
    $capacityTotal = (int) ($sale['capacity_total'] ?? 30);
    $earlySold = (int) ($sale['early_bird_sold'] ?? 0);
    $earlyTotal = (int) ($sale['early_bird_total'] ?? 10);

    if ($buyerName === '') {
        $buyerName = '(nije dostupno)';
    }
    if ($buyerEmail === '') {
        $buyerEmail = '(nije dostupno)';
    }

    $subject = 'Nova ulaznica za OSTANI U KONTAKTU. 🎟️';
    $body = "Nova ulaznica za OSTANI U KONTAKTU. 🧡\n"
        . "\n"
        . 'Ime: ' . $buyerName . "\n"
        . 'Email: ' . $buyerEmail . "\n"
        . 'Ulaznica: ' . $tierLabel . "\n"
        . 'Iznos: ' . $amount . " €\n"
        . "\n"
        . 'Prodano: ' . $totalSold . '/' . $capacityTotal . "\n"
        . 'Early Bird: ' . $earlySold . '/' . $earlyTotal . "\n";

    return meetup_notify_smtp_send($config, $to, $from, $fromName, $subject, $body);
}

/**
 * Authenticated SMTP send (SSL on 465 or STARTTLS on 587). Pure PHP, no library.
 *
 * @return array{ok:bool, skipped?:bool, reason?:string}
 */
function meetup_notify_smtp_send(
    array $config,
    string $to,
    string $from,
    string $fromName,
    string $subject,
    string $body
): array {
    $host = trim((string) $config['smtp_host']);
    $port = (int) ($config['smtp_port'] ?? 465);
    if ($port <= 0) {
        $port = 465;
    }
    $username = trim((string) $config['smtp_username']);
    $password = (string) ($config['smtp_password'] ?? '');
    $encryption = strtolower(trim((string) ($config['smtp_encryption'] ?? 'ssl')));
    if ($encryption !== 'tls' && $encryption !== 'ssl') {
        $encryption = $port === 587 ? 'tls' : 'ssl';
    }

    $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client(
        $remote,
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT
    );

    if ($socket === false) {
        error_log('meetup notify smtp: connect failed host=' . $host . ' errno=' . $errno . ' ' . $errstr);
        return ['ok' => false, 'reason' => 'smtp_connect_failed'];
    }

    stream_set_timeout($socket, 20);

    try {
        meetup_notify_smtp_expect($socket, [220]);

        $ehloHost = 'monikajagic.com';
        meetup_notify_smtp_command($socket, 'EHLO ' . $ehloHost, [250]);

        if ($encryption === 'tls') {
            meetup_notify_smtp_command($socket, 'STARTTLS', [220]);
            $crypto = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($crypto !== true) {
                throw new RuntimeException('smtp_starttls_failed');
            }
            meetup_notify_smtp_command($socket, 'EHLO ' . $ehloHost, [250]);
        }

        meetup_notify_smtp_command($socket, 'AUTH LOGIN', [334]);
        meetup_notify_smtp_command($socket, base64_encode($username), [334]);
        meetup_notify_smtp_command($socket, base64_encode($password), [235]);

        meetup_notify_smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
        meetup_notify_smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        meetup_notify_smtp_command($socket, 'DATA', [354]);

        $encodedSubject = meetup_notify_encode_header($subject);
        $encodedFromName = meetup_notify_encode_header($fromName);
        $headers = [
            'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
            'From: ' . $encodedFromName . ' <' . $from . '>',
            'To: <' . $to . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        $normalizedBody = str_replace(["\r\n", "\r"], "\n", $body);
        $normalizedBody = str_replace("\n.", "\n..", $normalizedBody);
        $payload = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $normalizedBody) . "\r\n.";
        meetup_notify_smtp_write($socket, $payload);
        meetup_notify_smtp_expect($socket, [250]);

        try {
            meetup_notify_smtp_command($socket, 'QUIT', [221]);
        } catch (Throwable $ignored) {
            // Delivery already accepted; ignore QUIT issues.
        }

        return ['ok' => true];
    } catch (Throwable $e) {
        error_log('meetup notify smtp: ' . $e->getMessage());
        return ['ok' => false, 'reason' => 'smtp_send_failed'];
    } finally {
        if (is_resource($socket)) {
            fclose($socket);
        }
    }
}

/**
 * @param resource $socket
 * @param list<int> $okCodes
 */
function meetup_notify_smtp_command($socket, string $command, array $okCodes): string
{
    meetup_notify_smtp_write($socket, $command);
    return meetup_notify_smtp_expect($socket, $okCodes);
}

/**
 * @param resource $socket
 */
function meetup_notify_smtp_write($socket, string $line): void
{
    $data = rtrim($line, "\r\n") . "\r\n";
    $written = fwrite($socket, $data);
    if ($written === false || $written === 0) {
        throw new RuntimeException('smtp_write_failed');
    }
}

/**
 * @param resource $socket
 * @param list<int> $okCodes
 */
function meetup_notify_smtp_expect($socket, array $okCodes): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
        // Multi-line replies use "250-..." until final "250 ...".
    }

    if ($response === '') {
        throw new RuntimeException('smtp_empty_response');
    }

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $okCodes, true)) {
        throw new RuntimeException('smtp_unexpected_code_' . $code . ':' . trim($response));
    }

    return $response;
}

function meetup_notify_encode_header(string $value): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $value) === 1) {
        return $value;
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}
