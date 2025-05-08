#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "wifiextender";
const char* password = "ABCD123456";

// Server details
// Update the server URL to point to your API endpoint
const char* serverUrl = "http://192.168.93.5/flood_system/api/index.php";
// Remove old database URL definition
// const char* oldServerUrl = "http://192.168.93.5/flood_route_system/api/index.php";
// Node identification (unique for each sensor)
const char* nodeId = "node1";  // Change to "node2" for second NodeMCU

// Pin definitions for water level sensor
const int waterSensorPin = A0;  // Analog pin for water level sensor

// Fixed location for this node (replace with actual coordinates)
const float latitude = 14.324827;   // Example: Biñan coordinates
const float longitude = 121.075392; // Example: Biñan coordinates

// Variables
int waterSensorValue;
float waterLevel;
String severity = "LOW";
String floodStatus = "NO_FLOOD";

// Calibration values - adjust these based on your sensor testing
const int dryValue = 0;          // Value when sensor is dry
const int maxWaterValue = 1023;  // Value when sensor is fully submerged
const float maxWaterHeight = 40.0; // Maximum water height in cm

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println();
  Serial.print("Connected to WiFi, IP address: ");
  Serial.println(WiFi.localIP());

  // Initialize water sensor
  pinMode(waterSensorPin, INPUT);
}

void loop() {
  // Measure water level
  if (measureWaterLevel()) {  // Only proceed if measurement was successful
    // Determine flood severity and status
    determineFloodStatus();
    
    // Send data to server
    sendDataToServer();
  }
  
  // Wait before next reading
  delay(60000); // 1 minute between readings
}

bool measureWaterLevel() {
  // Read the analog value from water level sensor
  waterSensorValue = analogRead(waterSensorPin);
  
  // Check for invalid sensor readings
  if (waterSensorValue < 0 || waterSensorValue > 1023) {
    Serial.println("Error: Invalid sensor reading!");
    return false;
  }

  // Convert sensor value to water level in centimeters
  // Using more precise floating-point calculation
  waterLevel = (waterSensorValue - dryValue) * (maxWaterHeight / (maxWaterValue - dryValue));
  
  // Ensure water level is not negative
  waterLevel = max(0.0f, waterLevel);  // Using float literal
  
  // Cap water level at maximum height
  waterLevel = min(waterLevel, maxWaterHeight);
  
  Serial.print("Water sensor value: ");
  Serial.println(waterSensorValue);
  Serial.print("Water level: ");
  Serial.print(waterLevel, 2);  // Print with 2 decimal places
  Serial.println(" cm");
  
  return true;
}

void determineFloodStatus() {
  // Determine severity based on water level
  if (waterLevel < 5.0) {
    severity = "LOW";
    floodStatus = "NO_FLOOD";
  } else if (waterLevel < 15.0) {
    severity = "MODERATE";
    floodStatus = "MINOR_FLOOD";
  } else if (waterLevel < 30.0) {
    severity = "HIGH";
    floodStatus = "SIGNIFICANT_FLOOD";
  } else {
    severity = "SEVERE";
    floodStatus = "MAJOR_FLOOD";
  }
  
  Serial.print("Flood status: ");
  Serial.println(floodStatus);
  Serial.print("Severity: ");
  Serial.println(severity);
}

// In the sendDataToServer() function, update the response handling:

void sendDataToServer() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting to reconnect...");
    WiFi.begin(ssid, password);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Failed to reconnect to WiFi");
      return;
    }
  }
  
  // Create JSON document
  DynamicJsonDocument doc(1024);
  doc["node_id"] = nodeId;
  doc["water_level"] = waterLevel;
  doc["severity"] = severity;
  doc["flood_status"] = floodStatus;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  doc["sensor_reading"] = waterSensorValue;
  
  // Set manual time offset (UTC+8 for Philippine Time)
  unsigned long timeOffset = 28800; // 8 hours in seconds
  unsigned long currentTime = millis() / 1000 + timeOffset;
  
  // Convert to formatted time string
  char timestamp[20];
  sprintf(timestamp, "%02d:%02d:%02d", 
          (currentTime / 3600) % 24, 
          (currentTime / 60) % 60, 
          currentTime % 60);
  
  doc["timestamp"] = timestamp;
}

// New function to handle HTTP requests to both servers
void sendHttpRequest(const char* url, String jsonData, String serverName) {
  WiFiClient client;
  HTTPClient http;
  
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.POST(jsonData);
  
  Serial.println("Sending data to " + serverName + "...");
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println(serverName + " HTTP Response code: " + String(httpResponseCode));
    
    // Only print the first 100 characters of the response to avoid flooding the serial monitor
    if (response.length() > 100) {
      Serial.println(serverName + " Response (truncated): " + response.substring(0, 100) + "...");
    } else {
      Serial.println(serverName + " Response: " + response);
    }
    
    // Only try to parse if response is not empty and looks like JSON (starts with { or [)
    if (response.length() > 0 && (response.startsWith("{") || response.startsWith("["))) {
      // Parse the JSON response
      DynamicJsonDocument responseDoc(1024);
      DeserializationError error = deserializeJson(responseDoc, response);
      
      if (!error) {
        // Check if data was successfully stored
        if (responseDoc.containsKey("success")) {
          bool success = responseDoc["success"];
          if (success) {
            Serial.println("Data successfully stored in " + serverName + "!");
            if (responseDoc.containsKey("node_id")) {
              Serial.print("Node ID: ");
              Serial.println(responseDoc["node_id"].as<String>());
            }
            if (responseDoc.containsKey("water_level")) {
              Serial.print("Water Level: ");
              Serial.println(responseDoc["water_level"].as<float>());
            }
            if (responseDoc.containsKey("timestamp")) {
              Serial.print("Timestamp: ");
              Serial.println(responseDoc["timestamp"].as<String>());
            }
          } else {
            Serial.print("Error storing data in " + serverName + ": ");
            Serial.println(responseDoc["error"].as<String>());
          }
        } else {
          Serial.println("Response doesn't contain success field");
        }
      } else {
        Serial.print("Error parsing " + serverName + " response: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.println("Response is not in JSON format. API endpoint might be returning HTML instead.");
      Serial.println("Please check your API endpoint configuration.");
    }
  } else {
    Serial.print("Error on sending POST to " + serverName + ": ");
    Serial.println(httpResponseCode);
    Serial.println("Error details: " + http.errorToString(httpResponseCode));
  }
  
  http.end();
}