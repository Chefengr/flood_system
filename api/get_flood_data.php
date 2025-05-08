<?php
// Set headers for JSON response
header("Content-Type: application/json; charset=UTF-8");
// Add these headers to allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");

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

// Get the latest data for each node
$sql = "SELECT s1.* 
        FROM sensor_data s1
        INNER JOIN (
            SELECT node_id, MAX(timestamp) as max_time
            FROM sensor_data
            GROUP BY node_id
        ) s2 ON s1.node_id = s2.node_id AND s1.timestamp = s2.max_time
        ORDER BY s1.node_id";

$result = $conn->query($sql);

if ($result) {
    $data = [];
    while ($row = $result->fetch_assoc()) {
        // Convert numeric fields to proper number types
        $row['water_level'] = (float)$row['water_level'];
        $row['latitude'] = (float)$row['latitude'];
        $row['longitude'] = (float)$row['longitude'];
        $row['sensor_reading'] = (int)$row['sensor_reading'];
        
        $data[] = $row;
    }
    echo json_encode($data);
} else {
    echo json_encode([
        "success" => false,
        "error" => "Error fetching data: " . $conn->error
    ]);
}

$conn->close();
?>
