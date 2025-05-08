<?php
require_once 'config.php';

class Database {
    private static $instance = null;
    private $conn;
    
    private function __construct() {
        try {
            $this->conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            
            if ($this->conn->connect_error) {
                throw new Exception("Connection failed: " . $this->conn->connect_error);
            }
            
            // Set charset to ensure proper encoding
            $this->conn->set_charset("utf8mb4");
            
            // Check if tables exist, create if they don't
            $this->initializeTables();
            
            logMessage("Database connection established successfully");
        } catch (Exception $e) {
            logMessage("Database connection error: " . $e->getMessage(), "ERROR");
            throw $e;
        }
    }
    
    // Singleton pattern to ensure only one database connection
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->conn;
    }
    
    private function initializeTables() {
        // Create sensor_data table with location_name field
        $sensorTableQuery = "
        CREATE TABLE IF NOT EXISTS sensor_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            node_id VARCHAR(50) NOT NULL,
            water_level DECIMAL(5,2) NOT NULL COMMENT 'Water level in centimeters',
            severity ENUM('LOW', 'MODERATE', 'HIGH', 'SEVERE') NOT NULL DEFAULT 'LOW',
            flood_status VARCHAR(50) COMMENT 'Current flood status',
            latitude DECIMAL(10, 8) COMMENT 'GPS latitude',
            longitude DECIMAL(11, 8) COMMENT 'GPS longitude',
            location_name VARCHAR(100) COMMENT 'Human-readable location name',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_node_id (node_id),
            INDEX idx_timestamp (timestamp),
            INDEX idx_severity (severity)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        // Create vehicle_types table
        $vehicleTableQuery = "
        CREATE TABLE IF NOT EXISTS vehicle_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            vehicle_type VARCHAR(50) NOT NULL,
            min_clearance DECIMAL(5,2) NOT NULL COMMENT 'Minimum clearance in centimeters',
            description TEXT,
            UNIQUE KEY (vehicle_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        // Execute queries
        $this->conn->query($sensorTableQuery);
        $this->conn->query($vehicleTableQuery);
        
        // Check if vehicle types exist, insert if they don't
        $result = $this->conn->query("SELECT COUNT(*) as count FROM vehicle_types");
        $row = $result->fetch_assoc();
        
        if ($row['count'] == 0) {
            $this->conn->query("
                INSERT INTO vehicle_types (vehicle_type, min_clearance, description) VALUES
                ('Sedan', 15.0, 'Standard passenger car'),
                ('SUV', 20.0, 'Sport utility vehicle'),
                ('Pickup', 25.0, 'Pickup truck'),
                ('4x4', 30.0, 'Off-road capable vehicle')
            ");
        }
        
        // Add location_name column if it doesn't exist
        $result = $this->conn->query("SHOW COLUMNS FROM sensor_data LIKE 'location_name'");
        if ($result->num_rows == 0) {
            $this->conn->query("ALTER TABLE sensor_data ADD COLUMN location_name VARCHAR(100) COMMENT 'Human-readable location name' AFTER longitude");
        }
    }
    
    public function saveSensorData($data) {
        try {
            // Map node_id to location names
            $locationMap = [
                'node1' => 'South Plains (Corner of Sto Tomas Road)',
                'node2' => 'South City Drive'
            ];
            
            // Set location name based on node_id
            $locationName = isset($locationMap[$data['node_id']]) ? $locationMap[$data['node_id']] : $data['node_id'];
            
            $stmt = $this->conn->prepare("
                INSERT INTO sensor_data (
                    node_id, water_level, severity, flood_status, latitude, longitude, location_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->bind_param(
                "sdssdds",
                $data['node_id'],
                $data['water_level'],
                $data['severity'],
                $data['flood_status'],
                $data['latitude'],
                $data['longitude'],
                $locationName
            );
            
            $result = $stmt->execute();
            $insertId = $stmt->insert_id;
            $stmt->close();
            
            return [
                'success' => $result,
                'id' => $insertId
            ];
        } catch (Exception $e) {
            logMessage("Error saving sensor data: " . $e->getMessage(), "ERROR");
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    public function getLatestFloodData() {
        try {
            $query = "
                SELECT 
                    s1.*,
                    CASE 
                        WHEN s1.severity = 'LOW' THEN 'Road is passable for all vehicles'
                        WHEN s1.severity = 'MODERATE' THEN 'Road is passable for SUV, Pickup, and 4x4 vehicles only'
                        WHEN s1.severity = 'HIGH' THEN 'Road is passable for Pickup and 4x4 vehicles only'
                        WHEN s1.severity = 'SEVERE' THEN 'Road is not passable for any vehicle'
                        ELSE 'Passability unknown'
                    END as passability_info
                FROM 
                    sensor_data s1
                JOIN (
                    SELECT 
                        node_id, 
                        MAX(timestamp) as max_time
                    FROM 
                        sensor_data
                    GROUP BY 
                        node_id
                ) s2 ON s1.node_id = s2.node_id AND s1.timestamp = s2.max_time
                ORDER BY s1.severity DESC
            ";
            
            $result = $this->conn->query($query);
            $data = [];
            
            while ($row = $result->fetch_assoc()) {
                // If location_name is empty, use the mapping
                if (empty($row['location_name'])) {
                    $locationMap = [
                        'node1' => 'South Plains (Corner of Sto Tomas Road)',
                        'node2' => 'South City Drive'
                    ];
                    $row['location_name'] = isset($locationMap[$row['node_id']]) ? $locationMap[$row['node_id']] : $row['node_id'];
                }
                
                $data[] = $row;
            }
            
            return $data;
        } catch (Exception $e) {
            logMessage("Error fetching flood data: " . $e->getMessage(), "ERROR");
            return [];
        }
    }
    
    public function getFloodedAreas($minWaterLevel) {
        try {
            $stmt = $this->conn->prepare("
                SELECT 
                    s1.*,
                    CASE 
                        WHEN s1.severity = 'LOW' THEN 'Road is passable for all vehicles'
                        WHEN s1.severity = 'MODERATE' THEN 'Road is passable for SUV, Pickup, and 4x4 vehicles only'
                        WHEN s1.severity = 'HIGH' THEN 'Road is passable for Pickup and 4x4 vehicles only'
                        WHEN s1.severity = 'SEVERE' THEN 'Road is not passable for any vehicle'
                        ELSE 'Passability unknown'
                    END as passability_info
                FROM 
                    sensor_data s1
                JOIN (
                    SELECT 
                        node_id, 
                        MAX(timestamp) as max_time
                    FROM 
                        sensor_data
                    GROUP BY 
                        node_id
                ) s2 ON s1.node_id = s2.node_id AND s1.timestamp = s2.max_time
                WHERE s1.water_level > ?
                ORDER BY s1.water_level DESC
            ");
            
            $stmt->bind_param("d", $minWaterLevel);
            $stmt->execute();
            
            $result = $stmt->get_result();
            $data = [];
            
            while ($row = $result->fetch_assoc()) {
                // If location_name is empty, use the mapping
                if (empty($row['location_name'])) {
                    $locationMap = [
                        'node1' => 'South Plains (Corner of Sto Tomas Road)',
                        'node2' => 'South City Drive'
                    ];
                    $row['location_name'] = isset($locationMap[$row['node_id']]) ? $locationMap[$row['node_id']] : $row['node_id'];
                }
                
                $data[] = $row;
            }
            
            $stmt->close();
            return $data;
        } catch (Exception $e) {
            logMessage("Error fetching flooded areas: " . $e->getMessage(), "ERROR");
            return [];
        }
    }
}
?>