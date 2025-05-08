<?php
// Set headers for JSON response
header("Content-Type: application/json; charset=UTF-8");

// Database connection
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "flood_system";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die(json_encode([
        "success" => false,
        "error" => "Connection failed: " . $conn->connect_error
    ]));
}

// Test if the table exists
$tableCheck = $conn->query("SHOW TABLES LIKE 'sensor_data'");
$tableExists = $tableCheck->num_rows > 0;

// Count records in the table
$recordCount = 0;
if ($tableExists) {
    $countResult = $conn->query("SELECT COUNT(*) as count FROM sensor_data");
    if ($countResult) {
        $row = $countResult->fetch_assoc();
        $recordCount = $row['count'];
    }
}

// Get a sample of data if available
$sampleData = [];
if ($tableExists && $recordCount > 0) {
    $sampleResult = $conn->query("SELECT * FROM sensor_data LIMIT 1");
    if ($sampleResult) {
        $sampleData = $sampleResult->fetch_assoc();
    }
}

// Return diagnostic information
echo json_encode([
    "success" => true,
    "database_connected" => true,
    "table_exists" => $tableExists,
    "record_count" => $recordCount,
    "sample_data" => $sampleData,
    "php_version" => phpversion(),
    "server_time" => date("Y-m-d H:i:s")
]);

$conn->close();
?>