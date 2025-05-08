<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'flood_system');

// Error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Logging function
function logMessage($message, $level = 'INFO') {
    $logFile = __DIR__ . '/logs/app.log';
    $dir = dirname($logFile);
    
    // Create logs directory if it doesn't exist
    if (!file_exists($dir)) {
        mkdir($dir, 0777, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $formattedMessage = "[$timestamp] [$level] $message" . PHP_EOL;
    
    file_put_contents($logFile, $formattedMessage, FILE_APPEND);
}
?>