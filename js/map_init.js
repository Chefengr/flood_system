// Global map instance
// At the beginning of map_init.js
if (typeof mapInstance === 'undefined') {
    let mapInstance;
    // Rest of your map initialization code
}
// Initialize map with flood data
function initMap(floodData) {
    console.log('Initializing map...');
    
    // If map is already initialized, just update markers
    if (mapInstance) {
        updateFloodMarkers(floodData);
        return;
    }
    
    // Create map centered on Biñan, Laguna
    mapInstance = L.map('map').setView([14.3292, 121.0794], 14);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
    
    // Add flood markers
    updateFloodMarkers(floodData);
    
    // Add destination marker
    const destinationIcon = L.icon({
        iconUrl: 'images/destination.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
    
    // Add destination marker for South City Homes
    L.marker([14.32392, 121.07389])
        .bindPopup('<strong>Destination:</strong><br>South City Homes, Brgy. Sto. Tomas')
        .addTo(mapInstance);
    
    console.log('Map initialized successfully');
}

// Update flood markers on the map
function updateFloodMarkers(floodData) {
    // Clear existing markers if any
    if (mapInstance.floodMarkers) {
        mapInstance.floodMarkers.forEach(marker => mapInstance.removeLayer(marker));
    }
    
    mapInstance.floodMarkers = [];
    
    // Add markers for each flood sensor
    if (floodData && floodData.length > 0) {
        floodData.forEach(item => {
            // Skip if no location data
            if (!item.latitude || !item.longitude) return;
            
            // Determine marker color based on severity
            const markerColor = getMarkerColor(item.water_level);
            
            // Create custom icon
            const icon = L.divIcon({
                className: 'flood-marker',
                html: `<div class="marker-pin ${markerColor}"></div>`,
                iconSize: [30, 42],
                iconAnchor: [15, 42],
                popupAnchor: [0, -42]
            });
            
            // Create marker
            const marker = L.marker([item.latitude, item.longitude], {icon})
                .bindPopup(`
                    <strong>${item.location}</strong><br>
                    Water Level: ${item.water_level} cm<br>
                    Status: ${getSeverityText(item.water_level)}<br>
                    Last Updated: ${item.timestamp}
                `)
                .addTo(mapInstance);
            
            mapInstance.floodMarkers.push(marker);
        });
    }
}

// Get marker color based on water level
function getMarkerColor(waterLevel) {
    waterLevel = parseFloat(waterLevel);
    
    if (waterLevel < 15) {
        return 'green';
    } else if (waterLevel < 30) {
        return 'yellow';
    } else if (waterLevel < 50) {
        return 'orange';
    } else {
        return 'red';
    }
}

// Get severity text based on water level
function getSeverityText(waterLevel) {
    waterLevel = parseFloat(waterLevel);
    
    if (waterLevel < 15) {
        return 'Normal (Passable by all vehicles)';
    } else if (waterLevel < 30) {
        return 'Moderate (Not passable by sedans)';
    } else if (waterLevel < 50) {
        return 'High (Only passable by trucks/4x4)';
    } else {
        return 'Severe (Not passable by any vehicle)';
    }
}