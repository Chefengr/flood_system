<?php
// Allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Get the posted data
$data = json_decode(file_get_contents("php://input"), true);

// Connect to database
$servername = "localhost";
$username = "root";
$password = ""; // Change this if your MySQL has a password
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

// Create table if it doesn't exist
$sql = "CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL,
    water_level FLOAT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    flood_status VARCHAR(50) NOT NULL,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    sensor_reading INT NOT NULL,
    timestamp DATETIME NOT NULL
)";

if (!$conn->query($sql)) {
    echo json_encode([
        "success" => false,
        "error" => "Error creating table: " . $conn->error
    ]);
    exit();
}

// Validate required fields
if (!isset($data['node_id']) || !isset($data['water_level'])) {
    echo json_encode([
        "success" => false,
        "error" => "Missing required fields"
    ]);
    exit();
}

// Prepare and bind
$stmt = $conn->prepare("INSERT INTO sensor_data (node_id, water_level, severity, flood_status, latitude, longitude, sensor_reading, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");

// Fix the bind_param function - remove the timestamp parameter since we're using NOW() in the SQL
$stmt->bind_param("sdssddi", 
    $data['node_id'], 
    $data['water_level'], 
    $data['severity'], 
    $data['flood_status'], 
    $data['latitude'], 
    $data['longitude'], 
    $data['sensor_reading']
);

// Remove this line as we're using NOW() directly in the SQL query
// $timestamp = date("Y-m-d H:i:s");

if ($stmt->execute()) {
    echo json_encode([
        "success" => true,
        "node_id" => $data['node_id'],
        "water_level" => $data['water_level'],
        "timestamp" => date("Y-m-d H:i:s") // Use current time for the response
    ]);
} else {
    echo json_encode([
        "success" => false,
        "error" => "Error: " . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>