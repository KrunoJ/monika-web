<?php
/**
 * Router for PHP built-in server (local API + static site).
 * Usage: php -S 127.0.0.1:8765 router.php
 */
declare(strict_types=1);

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');

if ($uri === '/api/meetup/ticket-status' || $uri === '/api/meetup/ticket-status/') {
    require __DIR__ . '/api/meetup/ticket-status.php';
    return true;
}

if ($uri === '/api/meetup/create-checkout' || $uri === '/api/meetup/create-checkout/') {
    require __DIR__ . '/api/meetup/create-checkout.php';
    return true;
}

if ($uri === '/api/meetup/session-status' || $uri === '/api/meetup/session-status/') {
    require __DIR__ . '/api/meetup/session-status.php';
    return true;
}

if ($uri === '/api/meetup/webhook' || $uri === '/api/meetup/webhook/') {
    require __DIR__ . '/api/meetup/webhook.php';
    return true;
}

$file = __DIR__ . $uri;
if ($uri !== '/' && is_file($file)) {
    return false;
}

if ($uri !== '/' && is_dir($file)) {
    $index = rtrim($file, '/') . '/index.html';
    if (is_file($index)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($index);
        return true;
    }
}

return false;
