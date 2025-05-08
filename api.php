<?php
require_once 'database.php';

class Api {
    /**
     * Handle incoming data from NodeMCU devices
     */
    public static function receiveDeviceData() {
        try {
            // Get JSON data from request body
            $jsonData = file_get_contents('php://input');
            $data = json_decode($jsonData, true);
            
            if (!$data) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON data']);
                return;
            }
            
            logMessage("Raw data from NodeMCU: " . $jsonData);
            
            // Validate required fields
            if (!isset($data['node_id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing node_id']);
                return;
            }
            
            // Set default values and validate
            $waterLevel = isset($data['water_level']) ? floatval($data['water_level']) : 0;
            
            // Determine severity based on water level if not provided
            if (!isset($data['severity'])) {
                if ($waterLevel < 5.0) {
                    $data['severity'] = 'LOW';
                    $data['flood_status'] = 'NO_FLOOD';
                } else if ($waterLevel < 15.0) {
                    $data['severity'] = 'MODERATE';
                    $data['flood_status'] = 'MINOR_FLOOD';
                } else if ($waterLevel < 30.0) {
                    $data['severity'] = 'HIGH';
                    $data['flood_status'] = 'SIGNIFICANT_FLOOD';
                } else {
                    $data['severity'] = 'SEVERE';
                    $data['flood_status'] = 'MAJOR_FLOOD';
                }
            }
            
            // Ensure severity is valid
            $validSeverities = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];
            $data['severity'] = in_array(strtoupper($data['severity']), $validSeverities) 
                ? strtoupper($data['severity']) 
                : 'LOW';
            
            // Set default coordinates if not provided
            $data['latitude'] = isset($data['latitude']) ? floatval($data['latitude']) : 14.3036;
            $data['longitude'] = isset($data['longitude']) ? floatval($data['longitude']) : 121.0781;
            
            // Save to database
            $db = Database::getInstance();
            $result = $db->saveSensorData($data);
            
            if ($result['success']) {
                http_response_code(201);
                echo json_encode([
                    'status' => 'success',
                    'message' => 'Data recorded',
                    'device_id' => $data['node_id'],
                    'id' => $result['id']
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Failed to save data',
                    'error' => $result['error']
                ]);
            }
        } catch (Exception $e) {
            logMessage("Error in receiveDeviceData: " . $e->getMessage(), "ERROR");
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Internal server error'
            ]);
        }
    }
    
    /**
     * Get flood data for the frontend
     */
    public static function getFloodData() {
        try {
            $db = Database::getInstance();
            $floodData = $db->getLatestFloodData();
            
            // Format timestamps for JSON
            foreach ($floodData as &$node) {
                if (isset($node['timestamp'])) {
                    $node['timestamp'] = date('c', strtotime($node['timestamp']));
                }
            }
            
            echo json_encode([
                'status' => 'success',
                'nodes' => $floodData
            ]);
        } catch (Exception $e) {
            logMessage("Error in getFloodData: " . $e->getMessage(), "ERROR");
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to retrieve data'
            ]);
        }
    }
    
    /**
     * Calculate route avoiding flooded areas
     */
    public static function getRoute() {
        try {
            // Get parameters
            $startLat = isset($_GET['start_lat']) ? floatval($_GET['start_lat']) : null;
            $startLon = isset($_GET['start_lon']) ? floatval($_GET['start_lon']) : null;
            $endLat = isset($_GET['end_lat']) ? floatval($_GET['end_lat']) : null;
            $endLon = isset($_GET['end_lon']) ? floatval($_GET['end_lon']) : null;
            $vehicleClearance = isset($_GET['clearance']) ? floatval($_GET['clearance']) : 20;
            
            // Validate parameters
            if ($startLat === null || $startLon === null || $endLat === null || $endLon === null) {
                http_response_code(400);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Missing required parameters'
                ]);
                return;
            }
            
            // Get flooded areas that exceed vehicle clearance
            $db = Database::getInstance();
            $floodedAreas = $db->getFloodedAreas($vehicleClearance);
            
            // Here you would integrate with OSRM to calculate the route
            // For now, we'll return a simplified response
            
            echo json_encode([
                'status' => 'success',
                'route' => [
                    'start' => [$startLat, $startLon],
                    'end' => [$endLat, $endLon],
                    'distance' => 5.2,  // km
                    'duration' => 15,   // minutes
                    'flooded_areas_avoided' => count($floodedAreas),
                    'waypoints' => [
                        // Example waypoints - in a real implementation, 
                        // these would come from OSRM
                        [$startLat, $startLon],
                        [14.3050, 121.0790],
                        [14.3070, 121.0800],
                        [$endLat, $endLon]
                    ]
                ]
            ]);
        } catch (Exception $e) {
            logMessage("Error in getRoute: " . $e->getMessage(), "ERROR");
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to calculate route'
            ]);
        }
    }
}
?>