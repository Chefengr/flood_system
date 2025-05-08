/**
 * Flood and Route System
 * Main JavaScript functionality
 */

// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    
    // Fetch flood data when page loads
    fetchFloodData();
    
    // Set up refresh button if it exists
    const refreshButton = document.getElementById('refreshData');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            fetchFloodData();
        });
    }
});

/**
 * Fetch the latest flood data from the API
 */
function fetchFloodData() {
    console.log('Fetching flood data...');
    
    // Show loading indicator
    document.getElementById('floodData').innerHTML = '<div class="loading">Loading flood data...</div>';
    
    fetch('index.php/flood-data')
        .then(handleResponse)
        .then(data => {
            console.log('Flood data received:', data);
            
            // Store flood data globally for route calculator to use
            window.floodData = data;
            
            displayFloodData(data);
            initMap(data);
        })
        .catch(error => {
            console.error('Error fetching flood data:', error);
            document.getElementById('floodData').innerHTML = 
                `<div class="error">Error loading flood data: ${error.message}</div>`;
        });
}

/**
 * Handle API response and check for errors
 */
function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
    }
    return response.json();
}

/**
 * Display flood data in a table format
 */
function displayFloodData(data) {
    if (!data || data.length === 0) {
        document.getElementById('floodData').innerHTML = 
            '<div class="loading">No flood data available.</div>';
        return;
    }

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Location</th>
                    <th>Water Level (cm)</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(item => {
        const severity = getSeverityClass(item.water_level);
        const status = getVehicleStatus(item.water_level);
        
        tableHtml += `
            <tr class="${severity}">
                <td>${item.location}</td>
                <td>${item.water_level}</td>
                <td>${getSeverityText(item.water_level)}</td>
                <td>${status}</td>
                <td>${item.timestamp}</td>
            </tr>
        `;
    });
    
    tableHtml += `
            </tbody>
        </table>
        <div class="last-updated">
            Last updated: ${new Date().toLocaleString()}
            <button id="refreshData" class="refresh-button">Refresh Data</button>
        </div>
    `;
    
    document.getElementById('floodData').innerHTML = tableHtml;
    
    // Re-attach refresh button event listener
    const refreshButton = document.getElementById('refreshData');
    if (refreshButton) {
        refreshButton.addEventListener('click', fetchFloodData);
    }
}

// Helper function to determine severity class based on water level
function getSeverityClass(waterLevel) {
    waterLevel = parseFloat(waterLevel);
    
    if (waterLevel < 15) {
        return 'normal';
    } else if (waterLevel < 30) {
        return 'moderate';
    } else if (waterLevel < 50) {
        return 'high';
    } else {
        return 'severe';
    }
}

// Helper function to get vehicle status based on water level
function getVehicleStatus(waterLevel) {
    waterLevel = parseFloat(waterLevel);
    
    if (waterLevel < 15) {
        return 'Passable by all vehicles';
    } else if (waterLevel < 30) {
        return 'Not passable by sedans';
    } else if (waterLevel < 50) {
        return 'Only passable by trucks/4x4';
    } else {
        return 'Not passable by any vehicle';
    }
}

// Get route from OSRM API
async function getRoute(start, end) {
    const OSRM_API_URL = 'http://router.project-osrm.org/route/v1/driving/';
    const url = `${OSRM_API_URL}${start[1]},${start[0]};${end[1]},${end[0]}?alternatives=true&steps=true&geometries=polyline`;
    console.log('Requesting route:', url);

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok') {
        throw new Error(data.message || 'Failed to calculate route');
    }

    return data;
}

/**
 * Initialize the map with flood data
 * This is a placeholder - implement with actual mapping library
 */
function initMap(floodData) {
    document.getElementById('map').innerHTML = 
        '<div style="padding: 20px; background-color: #e9ecef; text-align: center;">' +
        '<h3>Interactive Map</h3>' +
        '<p>Map would be displayed here with flood data markers.</p>' +
        '<p>Implement with Google Maps or Leaflet for a real application.</p>' +
        '</div>';
    
    // Uncomment and modify this code when implementing with an actual mapping library
    /*
    // For Google Maps implementation:
    const mapCenter = calculateMapCenter(floodData);
    const map = new google.maps.Map(document.getElementById('map'), {
        center: mapCenter,
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });
    
    // Add markers for flood data
    floodData.forEach(item => {
        if (item.latitude && item.longitude) {
            const markerColor = getSeverityColor(item.severity);
            
            const marker = new google.maps.Marker({
                position: {lat: parseFloat(item.latitude), lng: parseFloat(item.longitude)},
                map: map,
                title: `${item.node_id}: ${item.water_level}cm (${item.severity})`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: markerColor,
                    fillOpacity: 0.8,
                    strokeWeight: 1,
                    scale: 10
                }
            });
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div>
                        <h3>${item.node_id}</h3>
                        <p>Water Level: ${item.water_level} cm</p>
                        <p>Severity: ${item.severity}</p>
                        <p>Status: ${item.flood_status || 'N/A'}</p>
                    </div>
                `
            });
            
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
        }
    });
    */
}

/**
 * Calculate the center point for the map based on flood data
 */
function calculateMapCenter(floodData) {
    // Default center if no valid coordinates
    const defaultCenter = {lat: 14.5995, lng: 120.9842}; // Manila, Philippines
    
    // Find valid coordinates in the data
    const validCoordinates = floodData.filter(item => 
        item.latitude && item.longitude && 
        !isNaN(parseFloat(item.latitude)) && 
        !isNaN(parseFloat(item.longitude))
    );
    
    if (validCoordinates.length === 0) {
        return defaultCenter;
    }
    
    // Calculate average lat/lng
    const sumLat = validCoordinates.reduce((sum, item) => sum + parseFloat(item.latitude), 0);
    const sumLng = validCoordinates.reduce((sum, item) => sum + parseFloat(item.longitude), 0);
    
    return {
        lat: sumLat / validCoordinates.length,
        lng: sumLng / validCoordinates.length
    };
}

/**
 * Get color based on severity level
 */
function getSeverityColor(severity) {
    switch(severity) {
        case 'LOW': return '#28a745';
        case 'MODERATE': return '#ffc107';
        case 'HIGH': return '#fd7e14';
        case 'SEVERE': return '#dc3545';
        default: return '#6c757d';
    }
}

/**
 * Find a safe route based on user input
 */
function findRoute() {
    const startPoint = document.getElementById('startPoint').value;
    const endPoint = document.getElementById('endPoint').value;
    const vehicleType = document.getElementById('vehicleType').value;
    
    if (!startPoint || !endPoint) {
        document.getElementById('routeResult').innerHTML = 
            '<div class="error">Please enter both start and end points.</div>';
        return;
    }
    
    document.getElementById('routeResult').innerHTML = 
        '<div class="loading">Finding the safest route...</div>';
        
    // Prepare query parameters
    const queryParams = new URLSearchParams({
        start: startPoint,
        end: endPoint,
        vehicle: vehicleType
    });
    
    // Call the API
    fetch(`index.php/route?${queryParams}`)
        .then(handleResponse)
        .then(data => {
            displayRouteResult(data);
        })
        .catch(error => {
            document.getElementById('routeResult').innerHTML = 
                `<div class="error">Error finding route: ${error.message}</div>`;
        });
}

/**
 * Display the route result
 */
function displayRouteResult(data) {
    let resultHtml = '<div class="route-result">';
    
    if (data.route) {
        resultHtml += `
            <div class="route-success">
                <h3>Safe Route Found</h3>
                <p><strong>Distance:</strong> ${data.distance || 'N/A'}</p>
                <p><strong>Estimated Time:</strong> ${data.duration || 'N/A'}</p>
                <p><strong>Flood Risk:</strong> ${data.floodRisk || 'Low'}</p>
                <div style="margin-top: 15px;">
                    <strong>Directions:</strong>
                    <ol>
        `;
        
        if (data.directions && data.directions.length) {
            data.directions.forEach(step => {
                resultHtml += `<li>${step}</li>`;
            });
        } else {
            resultHtml += `<li>Follow the recommended route on the map.</li>`;
        }
        
        resultHtml += `
                    </ol>
                </div>
            </div>
        `;
    } else {
        resultHtml += `
            <div class="route-failure">
                <h3>No Safe Route Available</h3>
                <p>${data.message || 'Unable to find a safe route with current flood conditions.'}</p>
                <p>Consider using a vehicle with higher clearance or waiting until flood conditions improve.</p>
            </div>
        `;
    }
    
    resultHtml += '</div>';
    document.getElementById('routeResult').innerHTML = resultHtml;
}