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

// Test data for two nodes with updated locations
$testData = [
    [
        'node_id' => 'node1',
        'water_level' => 3.5,
        'severity' => 'LOW',
        'flood_status' => 'NO_FLOOD',
        'latitude' => 14.324357,  // South Plains corner of Sto Tomas Road
        'longitude' => 121.073461,
        'location_name' => 'South Plains (Corner of Sto Tomas Road)'
    ],
    [
        'node_id' => 'node2',
        'water_level' => 12.8,
        'severity' => 'MODERATE',
        'flood_status' => 'MINOR_FLOOD',
        'latitude' => 14.329876,  // South City Drive
        'longitude' => 121.081234,
        'location_name' => 'South City Drive'
    ]
];

// Insert test data
$success = true;
$insertedCount = 0;

foreach ($testData as $data) {
    // Check if location_name column exists
    $result = $conn->query("SHOW COLUMNS FROM sensor_data LIKE 'location_name'");
    
    if ($result->num_rows > 0) {
        // Column exists, use it
        $stmt = $conn->prepare("INSERT INTO sensor_data (node_id, water_level, severity, flood_status, latitude, longitude, location_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->bind_param("sdssdds", 
            $data['node_id'], 
            $data['water_level'], 
            $data['severity'], 
            $data['flood_status'], 
            $data['latitude'], 
            $data['longitude'],
            $data['location_name']
        );
    } else {
        // Column doesn't exist, use old schema
        $stmt = $conn->prepare("INSERT INTO sensor_data (node_id, water_level, severity, flood_status, latitude, longitude, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt->bind_param("sdssdd", 
            $data['node_id'], 
            $data['water_level'], 
            $data['severity'], 
            $data['flood_status'], 
            $data['latitude'], 
            $data['longitude']
        );
    }
    
    if ($stmt->execute()) {
        $insertedCount++;
    } else {
        $success = false;
    }
    
    $stmt->close();
}

// Return result
echo json_encode([
    "success" => $success,
    "inserted_count" => $insertedCount,
    "message" => $success ? "Test data inserted successfully" : "Error inserting test data"
]);

$conn->close();
?>