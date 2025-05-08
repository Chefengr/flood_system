

// To this (use the absolute URL to your XAMPP server)
const API_URL = 'http://localhost/flood_system/api/get_flood_data.php';
const REFRESH_INTERVAL = 60000; // Refresh data every 60 seconds

// DOM Elements
let floodDataContainer;
let mapInstance;
let sensorMarkers = [];

// Initialize the flood data display
function initFloodData() {
    console.log('Initializing flood data display...');
    floodDataContainer = document.getElementById('floodData');
    
    // Initialize map if it exists on the page
    const mapElement = document.getElementById('map');
    if (mapElement) {
        initMap(mapElement);
    }
    
    // Load initial data
    fetchFloodData();
    
    // Set up automatic refresh
    setInterval(fetchFloodData, REFRESH_INTERVAL);
}

// Fetch flood data from the server
function fetchFloodData() {
    console.log('Fetching flood data from:', API_URL);
    
    fetch(API_URL)
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);
            displayFloodData(data);
            updateMap(data);
        })
        .catch(error => {
            console.error('Error fetching flood data:', error);
            floodDataContainer.innerHTML = '<p class="error">Error loading flood data. Please try again later.<br>Details: ' + error.message + '</p>';
        });
}

// Add node location mapping
const NODE_LOCATIONS = {
    'node1': {
        address: 'South Plains Corner Sto. Tomas Road',
        coordinates: [14.324827, 121.075392]
    },
    'node2': {
        address: 'South City Drive Corner Sto. Tomas Road',
        coordinates: [14.324357, 121.073461]
    }
};

// Add vehicle passability warnings
const SEVERITY_WARNINGS = {
    'LOW': 'Passable to all types of vehicles',
    'MODERATE': 'Only passable to SUV, Pickup, and 4x4 vehicles',
    'HIGH': 'Road not passable to any vehicle',
    'SEVERE': 'Road not passable to any vehicle - Severe flooding'
};

// Display flood data in the UI
function displayFloodData(data) {
    if (!data || data.length === 0) {
        floodDataContainer.innerHTML = '<p>No flood data available. Make sure your sensors are sending data to the database.</p>';
        return;
    }
    
    // Remove loading state if present
    floodDataContainer.classList.remove('loading');
    
    let html = '<div class="flood-data-grid">';
    
    data.forEach(sensor => {
        const severityClass = sensor.severity.toLowerCase();
        const nodeLocation = NODE_LOCATIONS[sensor.node_id] || { address: 'Unknown Location', coordinates: [0, 0] };
        const warning = SEVERITY_WARNINGS[sensor.severity.toUpperCase()];
        
        html += `
            <div class="sensor-card ${severityClass}">
                <h3>Sensor: ${sensor.node_id}</h3>
                <div class="sensor-details">
                    <p><strong>Location:</strong> ${nodeLocation.address}</p>
                    <p><strong>Water Level:</strong> ${sensor.water_level} cm</p>
                    <p><strong>Status:</strong> ${sensor.flood_status.replace(/_/g, ' ')}</p>
                    <p><strong>Severity:</strong> <span class="severity-badge ${severityClass}">${sensor.severity}</span></p>
                    <p><strong>Warning:</strong> ${warning}</p>
                    <p><strong>Last Updated:</strong> ${formatTimestamp(sensor.timestamp)}</p>
                    <p><strong>Coordinates:</strong> ${nodeLocation.coordinates[0].toFixed(6)}, ${nodeLocation.coordinates[1].toFixed(6)}</p>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    floodDataContainer.innerHTML = html;
}

// Update map with sensor data
function updateMap(data) {
    if (!mapInstance) return;
    
    // Clear existing markers
    sensorMarkers.forEach(marker => mapInstance.removeLayer(marker));
    sensorMarkers = [];
    
    // Add new markers
    data.forEach(sensor => {
        const severityColor = getSeverityColor(sensor.severity);
        const nodeLocation = NODE_LOCATIONS[sensor.node_id] || { address: 'Unknown Location', coordinates: [0, 0] };
        const warning = SEVERITY_WARNINGS[sensor.severity.toUpperCase()];
        
        const marker = L.circleMarker(nodeLocation.coordinates, {
            radius: 10,
            fillColor: severityColor,
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(mapInstance);
        
        marker.bindPopup(`
            <strong>Sensor: ${sensor.node_id}</strong><br>
            <strong>Location:</strong> ${nodeLocation.address}<br>
            Water Level: ${sensor.water_level} cm<br>
            Status: ${sensor.flood_status.replace(/_/g, ' ')}<br>
            Severity: ${sensor.severity}<br>
            Warning: ${warning}<br>
            Last Updated: ${formatTimestamp(sensor.timestamp)}
        `);
        
        sensorMarkers.push(marker);
    });
}

// Initialize the map with the correct center point
function initMap(mapElement) {
    // Center the map between the two nodes
    const centerLat = (NODE_LOCATIONS.node1.coordinates[0] + NODE_LOCATIONS.node2.coordinates[0]) / 2;
    const centerLng = (NODE_LOCATIONS.node1.coordinates[1] + NODE_LOCATIONS.node2.coordinates[1]) / 2;
    
    mapInstance = L.map(mapElement).setView([centerLat, centerLng], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
}

// Helper function to get color based on severity
function getSeverityColor(severity) {
    const upperSeverity = severity.toUpperCase();
    if (upperSeverity === 'LOW') return '#4CAF50'; // Green
    if (upperSeverity === 'MODERATE') return '#FFC107'; // Yellow
    if (upperSeverity === 'HIGH') return '#F44336'; // Red (changed from orange)
    if (upperSeverity === 'SEVERE') return '#F44336'; // Red
    return '#2196F3'; // Blue
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initFloodData);