<?php
// Main entry point for the application
header("Content-Type: application/json");
require_once 'config.php';
require_once 'database.php';
require_once 'api.php';

// Handle CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Route the request to the appropriate handler
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);
$path = trim(str_replace('/api', '', $path), '/');

// API routing
switch ($path) {
    case 'device-data':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            Api::receiveDeviceData();
        } else {
            http_response_code(405); // Method Not Allowed
            echo json_encode(['error' => 'Method not allowed']);
        }
        break;
        
    case 'flood-data':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            Api::getFloodData();
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
        }
        break;
        
    case 'route':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            Api::getRoute();
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
        }
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
}
?>