// Route Calculator Script - Using OSRM API
// Focuses on Laguna locations with Brgy. Sto. Tomas as primary destination

// ======================
// Configuration Constants
// ======================
const RouteConfig = {
    OSRM_API_URL: 'https://router.project-osrm.org/route/v1/driving/',
    DESTINATION: {
        name: 'South City Homes, Brgy. Sto. Tomas',
        coordinates: [14.32392, 121.07389]
    },
    START_LOCATIONS: {
        'Biñan': [
            { name: 'SM City Biñan', coordinates: [14.33302, 121.08215] },
            { name: 'Biñan Public Market', coordinates: [14.33840, 121.08498] },
            { name: 'Biñan City Hall', coordinates: [14.33523, 121.07961] },
            { name: 'Southwoods Mall', coordinates: [14.33212, 121.05027] },
            { name: 'Trimex Colleges', coordinates: [14.33909, 121.08523] },
            { name: 'Sta Catalina College', coordinates: [14.33976, 121.08776] },
            { name: 'Lakeshore Institution', coordinates: [14.33834, 121.08062] },
            { name: 'Canlalay Fire Station', coordinates: [14.33693, 121.07772] },
            { name: 'Biñan City Hospital', coordinates: [14.33701, 121.07451] }
        ],
        'Santa Rosa': [
            { name: 'SM City Santa Rosa', coordinates: [14.3127, 121.0997] },
            { name: 'Nuvali', coordinates: [14.2377, 121.0557] },
            { name: 'Paseo de Santa Rosa', coordinates: [14.3042, 121.0874] }
        ],
        'Calamba': [
            { name: 'SM City Calamba', coordinates: [14.2119, 121.1647] },
            { name: 'University of the Philippines Los Baños', coordinates: [14.1648, 121.2413] }
        ]
    },
    NODE_LOCATIONS: {
        'node1': {
            name: 'South Plains',
            coordinates: [14.324827, 121.075392]
        },
        'node2': {
            name: 'South City Drive',
            coordinates: [14.324357, 121.073461]
        }
    }
};

// Vehicle capabilities for flood water
const vehicleCapabilities = {
    'sedan': { maxWaterLevel: 10 },
    'suv': { maxWaterLevel: 30 },
    'pickup': { maxWaterLevel: 40 },
    '4x4': { maxWaterLevel: 50 }
};

// ======================
// Core Functions
// ======================

// Calculate distance between two coordinates (in km)
function calculateDistance(coord1, coord2) {
    const lat1 = coord1[0];
    const lon1 = coord1[1];
    const lat2 = coord2[0];
    const lon2 = coord2[1];
    
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Decode polyline from OSRM response
function decodePolyline(str, precision = 5) {
    let index = 0, lat = 0, lng = 0, coordinates = [];
    const factor = Math.pow(10, precision);

    while (index < str.length) {
        let byte = null, shift = 0, result = 0;
        
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}

// ======================
// Route Calculation
// ======================

// Get route from OSRM API
async function getRoute(start, end, routeType = 'shortest') {
    // OSRM expects coordinates as [longitude, latitude]
    const url = `${RouteConfig.OSRM_API_URL}${start[1]},${start[0]};${end[1]},${end[0]}?alternatives=true&steps=true&geometries=polyline&overview=full`;
    console.log('Requesting route:', url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.code !== 'Ok') {
            throw new Error(data.message || 'Failed to calculate route');
        }

        // Sort routes based on routeType preference
        let routes = data.routes;
        if (routes.length > 1) {
            if (routeType === 'shortest') {
                // Already sorted by duration in OSRM response
            } else if (routeType === 'safest') {
                // For "safest", we'll prefer routes with less turns/complexity
                routes.sort((a, b) => a.legs[0].steps.length - b.legs[0].steps.length);
            } else if (routeType === 'longest') {
                // For "longest", we'll reverse the default sorting
                routes.reverse();
            }
        }

        return routes[0]; // Return the best route based on sorting
    } catch (error) {
        console.error('Error fetching route:', error);
        throw error;
    }
}

// ======================
// Flood Detection
// ======================

// Get current flood data from global variable
function getCurrentFloodData() {
    try {
        if (typeof window.floodData !== 'undefined' && window.floodData !== null && Array.isArray(window.floodData)) {
            return window.floodData;
        }
        console.warn('No valid flood data available, using mock data');
        // Return mock data if no flood data is available
        return [
            {
                node_id: 'node1',
                water_level: '25',
                severity: 'Moderate'
            }
        ];
    } catch (error) {
        console.error('Error getting flood data:', error);
        return [];
    }
}

// Check if route intersects with flood points
function checkFloodIntersection(coordinates, vehicleType) {
    const floodData = getCurrentFloodData();
    const maxWaterLevel = vehicleCapabilities[vehicleType]?.maxWaterLevel || 15;
    
    // Check if floodData is iterable
    if (!floodData || !Array.isArray(floodData)) {
        console.error('Flood data is not available or not in the expected format');
        return {
            intersects: false,
            severity: 'Unknown',
            water_level: 0,
            isPassable: true
        };
    }
    
    for (const coord of coordinates) {
        for (const floodPoint of floodData) {
            if (!floodPoint.node_id || !RouteConfig.NODE_LOCATIONS[floodPoint.node_id]) continue;
            
            const nodeCoord = RouteConfig.NODE_LOCATIONS[floodPoint.node_id].coordinates;
            const distance = calculateDistance(coord, nodeCoord);
            
            // If route passes within 0.5km of a flood point
            if (distance < 0.5) {
                const waterLevel = parseFloat(floodPoint.water_level);
                return {
                    intersects: true,
                    severity: floodPoint.severity,
                    water_level: waterLevel,
                    isPassable: waterLevel <= maxWaterLevel,
                    coordinates: coord,
                    node: floodPoint.node_id
                };
            }
        }
    }
    
    return { intersects: false };
}

// ======================
// UI Functions
// ======================

// Populate start location dropdown
function populateStartLocations(selectElement) {
    if (!selectElement) {
        console.error('Start location select element not found');
        return;
    }
    
    console.log('Populating start locations...');
    
    // Clear existing options except the first one
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Add custom location option at the top
    const customOptgroup = document.createElement('optgroup');
    customOptgroup.label = 'Custom Location';
    
    const customOption = document.createElement('option');
    customOption.text = 'Enter custom location';
    customOption.value = 'custom';
    customOptgroup.appendChild(customOption);
    selectElement.appendChild(customOptgroup);
    
    // Add option groups for each area
    for (const [area, locations] of Object.entries(RouteConfig.START_LOCATIONS)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = area;
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.text = location.name;
            option.value = JSON.stringify(location.coordinates);
            optgroup.appendChild(option);
        });
        
        selectElement.appendChild(optgroup);
    }
    
    console.log('Start locations populated successfully');
    
    // Add event listener for custom location selection
    selectElement.addEventListener('change', function() {
        const customLocationInput = document.getElementById('customLocationInput');
        if (this.value === 'custom') {
            if (!customLocationInput) {
                createCustomLocationInput();
            } else {
                customLocationInput.style.display = 'block';
            }
        } else if (customLocationInput) {
            customLocationInput.style.display = 'none';
        }
    });
}

// Create custom location input field
function createCustomLocationInput() {
    const routeForm = document.querySelector('.route-form') || document.querySelector('form');
    if (!routeForm) return;
    
    const startLocationSelect = document.getElementById('startLocation');
    if (!startLocationSelect) return;
    
    const customLocationDiv = document.createElement('div');
    customLocationDiv.id = 'customLocationInput';
    customLocationDiv.className = 'custom-location-input';
    customLocationDiv.innerHTML = `
        <input type="text" id="customLocationAddress" 
               placeholder="Enter address in Laguna, Philippines" 
               class="form-control">
        <button type="button" id="searchLocationBtn" class="btn btn-secondary">
            Search
        </button>
    `;
    
    // Insert after the start location dropdown
    startLocationSelect.parentNode.insertBefore(customLocationDiv, startLocationSelect.nextSibling);
    
    // Add event listener for the search button
    document.getElementById('searchLocationBtn').addEventListener('click', searchCustomLocation);
}

// Search for custom location using Nominatim API
async function searchCustomLocation() {
    const addressInput = document.getElementById('customLocationAddress');
    if (!addressInput || !addressInput.value.trim()) {
        alert('Please enter a location address');
        return;
    }
    
    const address = addressInput.value.trim() + ', Laguna, Philippines';
    const searchBtn = document.getElementById('searchLocationBtn');
    
    try {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
        
        // Use OpenStreetMap's Nominatim service for geocoding
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await response.json();
        
        if (data.length === 0) {
            throw new Error('Location not found. Please try a different address.');
        }
        
        const result = data[0];
        const coordinates = [parseFloat(result.lat), parseFloat(result.lon)];
        
        // Store the custom coordinates in a global variable
        window.customLocationCoordinates = coordinates;
        
        // Update the UI to show the found location
        const customLocationDiv = document.getElementById('customLocationInput');
        const locationInfoDiv = document.createElement('div');
        locationInfoDiv.className = 'location-found-info';
        locationInfoDiv.innerHTML = `
            <p><strong>Found:</strong> ${result.display_name}</p>
            <p><small>Coordinates: [${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}]</small></p>
        `;
        
        // Replace any existing location info
        const existingInfo = customLocationDiv.querySelector('.location-found-info');
        if (existingInfo) {
            customLocationDiv.replaceChild(locationInfoDiv, existingInfo);
        } else {
            customLocationDiv.appendChild(locationInfoDiv);
        }
        
        console.log('Custom location found:', result.display_name, coordinates);
    } catch (error) {
        console.error('Error searching for location:', error);
        alert(error.message || 'Failed to find location. Please try again.');
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search';
    }
}

// Get color for route based on flood status
function getRouteColor(floodIntersection, routeType) {
    if (!floodIntersection.intersects) return '#4CAF50'; // Green
    if (floodIntersection.isPassable) {
        return routeType === 'shortest' ? '#FFC107' : '#FF9800'; // Yellow/Orange
    }
    return '#F44336'; // Red
}

// Set loading state for calculate button
function setLoadingState(isLoading) {
    const button = document.getElementById('calculateRoute');
    if (button) {
        button.disabled = isLoading;
        button.innerHTML = isLoading ? 
            '<span class="spinner"></span> Calculating...' : 
            'Calculate Route';
    }
}

// ======================
// Main Route Calculation
// ======================

async function calculateRoute() {
    try {
        console.log('Starting route calculation...');
        setLoadingState(true);
        
        // Get form values
        const startLocationSelect = document.getElementById('startLocation');
        const vehicleTypeSelect = document.getElementById('vehicleType');
        const routeTypeSelect = document.getElementById('routeType');
        const routeInfo = document.getElementById('routeInfo');

        if (!startLocationSelect || !vehicleTypeSelect || !routeTypeSelect) {
            throw new Error('Required form elements not found');
        }

        if (!startLocationSelect.value) {
            throw new Error('Please select a start location');
        }

        // Handle custom location
        let startCoords;
        if (startLocationSelect.value === 'custom') {
            if (!window.customLocationCoordinates) {
                throw new Error('Please search for a custom location first');
            }
            startCoords = window.customLocationCoordinates;
        } else {
            startCoords = JSON.parse(startLocationSelect.value);
        }

        const vehicleType = vehicleTypeSelect.value || 'sedan';
        const routeType = routeTypeSelect.value || 'safest';

        console.log('Route parameters:', {
            start: startCoords,
            destination: RouteConfig.DESTINATION.coordinates,
            vehicleType,
            routeType
        });

        // Show loading state
        if (routeInfo) {
            routeInfo.innerHTML = '<div class="loading">Calculating route...</div>';
        }

        // Clear previous routes
        if (window.routeLayer) {
            window.routeLayer.clearLayers();
        } else if (window.mapInstance) {
            window.routeLayer = L.layerGroup().addTo(window.mapInstance);
        } else {
            console.error('Map instance not available');
            throw new Error('Map not initialized. Please refresh the page and try again.');
        }
        
        // Calculate primary route
        const primaryRoute = await getRoute(startCoords, RouteConfig.DESTINATION.coordinates, routeType);
        const coordinates = decodePolyline(primaryRoute.geometry);
        const floodCheck = checkFloodIntersection(coordinates, vehicleType);
        
        const viableRoutes = [];
        
        // Check if primary route is viable
        if (!floodCheck.intersects || floodCheck.isPassable) {
            viableRoutes.push({
                name: "Direct Route",
                distance: primaryRoute.distance,
                duration: primaryRoute.duration,
                geometry: primaryRoute.geometry,
                legs: primaryRoute.legs
            });
        }
        
        // Process and display viable routes
        if (viableRoutes.length > 0) {
            processRoutes(viableRoutes, vehicleType, routeType);
        } else {
            throw new Error('No safe routes found for your vehicle type. Consider using a vehicle with higher flood capability.');
        }
    } catch (error) {
        console.error('Route calculation error:', error);
        
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) {
            routeInfo.innerHTML = `<div class="route-error">${error.message}</div>`;
        }
        
        alert(error.message);
    } finally {
        setLoadingState(false);
    }
}

function processRoutes(routes, vehicleType, routeType) {
    const routeInfo = document.getElementById('routeInfo');
    if (!routeInfo) return;
    
    routeInfo.innerHTML = '';
    const routeInfoContainer = document.createElement('div');
    routeInfoContainer.className = 'route-info';
    
    routes.forEach((route, index) => {
        const distance = (route.distance / 1000).toFixed(2);
        const duration = Math.round(route.duration / 60);
        const coordinates = decodePolyline(route.geometry);
        const floodCheck = checkFloodIntersection(coordinates, vehicleType);
        
        const routeOption = document.createElement('div');
        routeOption.className = `route-option ${!floodCheck.isPassable && floodCheck.intersects ? 'not-passable' : ''}`;
        
        const routeName = route.name || `Route ${index + 1}`;
        const startCoords = JSON.parse(document.getElementById('startLocation').value);
        const wazeUrl = `https://waze.com/ul?ll=${RouteConfig.DESTINATION.coordinates[0]},${RouteConfig.DESTINATION.coordinates[1]}&navigate=yes&from=${startCoords[0]},${startCoords[1]}`;
        
        let routeContent = `
            <h3>${routeName}</h3>
            <div class="route-type-label">${routeType.charAt(0).toUpperCase() + routeType.slice(1)} Route</div>
            <div><strong>Distance:</strong> ${distance} km</div>
            <div><strong>Estimated Time:</strong> ${duration} minutes</div>
        `;
        
        if (floodCheck.intersects) {
            const severityClass = floodCheck.isPassable ? 'warning' : 'danger';
            routeContent += `
                <div class="${severityClass}">
                    <strong>Warning:</strong> This route passes through a ${floodCheck.severity.toLowerCase()} flood area.
                    ${floodCheck.isPassable ? 'Your vehicle can pass through.' : 'Your vehicle cannot pass through.'}
                </div>
            `;
        } else {
            routeContent += `<div class="safe"><strong>Safe Route:</strong> No flooding detected.</div>`;
        }
        
        routeContent += `
            <div class="navigation-buttons">
                <a href="${wazeUrl}" target="_blank" class="waze-button">
                    Navigate with Waze
                </a>
            </div>
        `;
        
        routeOption.innerHTML = routeContent;
        routeInfoContainer.appendChild(routeOption);
        
        // Draw route on map
        if (window.routeLayer) {
            const routeColor = getRouteColor(floodCheck, routeType);
            const polyline = L.polyline(coordinates, {
                color: routeColor,
                weight: 5,
                opacity: 0.7
            }).addTo(window.routeLayer);
            
            polyline.bindPopup(`
                <strong>${routeName}</strong><br>
                Distance: ${distance} km<br>
                Time: ${duration} minutes
                ${floodCheck.intersects ? `<br><strong>Warning:</strong> Passes through ${floodCheck.severity.toLowerCase()} flood area.` : ''}
            `);
        }
    });
    
    routeInfo.appendChild(routeInfoContainer);
}

// ======================
// Map Initialization
// ======================

function initMap() {
    console.log('Initializing map...');
    
    // Create map if it doesn't exist
    if (!window.mapInstance) {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('Map element not found');
            return false;
        }
        
        window.mapInstance = L.map('map').setView([14.32392, 121.07389], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(window.mapInstance);
        
        // Add destination marker
        L.marker(RouteConfig.DESTINATION.coordinates)
            .addTo(window.mapInstance)
            .bindPopup(`<strong>${RouteConfig.DESTINATION.name}</strong><br>Destination`)
            .openPopup();
        
        // Add flood node markers
        for (const [nodeId, node] of Object.entries(RouteConfig.NODE_LOCATIONS)) {
            L.circleMarker(node.coordinates, {
                color: 'blue',
                fillColor: '#30f',
                fillOpacity: 0.5,
                radius: 8
            }).addTo(window.mapInstance)
              .bindPopup(`<strong>${node.name}</strong><br>Flood Sensor Node`);
        }
        
        console.log('Map initialized successfully');
        return true;
    }
    
    return true;
}

// ======================
// Initialization
// ======================

function initializeRouteCalculator() {
    console.log('Initializing route calculator...');
    
    // Initialize map first
    if (!initMap()) {
        console.error('Failed to initialize map');
        return false;
    }
    
    // Check required DOM elements
    const requiredElements = [
        'startLocation', 'vehicleType', 'routeType', 
        'calculateRoute', 'routeInfo'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.error('Missing elements:', missingElements);
        return false;
    }
    
    // Initialize route layer
    if (!window.routeLayer && window.mapInstance) {
        window.routeLayer = L.layerGroup().addTo(window.mapInstance);
    }
    
    // Populate start locations
    populateStartLocations(document.getElementById('startLocation'));
    
    // Setup calculate button
    const calculateButton = document.getElementById('calculateRoute');
    calculateButton.disabled = false;
    calculateButton.addEventListener('click', function(e) {
        e.preventDefault();
        calculateRoute().catch(console.error);
    });
    
    console.log('Route calculator successfully initialized!');
    return true;
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing route calculator...');
    setTimeout(initializeRouteCalculator, 500); // Small delay to ensure all elements are ready
});

// Make functions available globally
window.calculateRoute = calculateRoute;
window.initRouteCalculator = initializeRouteCalculator;
window.getMarkerColor = getMarkerColor;

function getMarkerColor(waterLevel) {
    waterLevel = parseFloat(waterLevel);
    
    if (waterLevel < 15) {
        return 'green';
    } else if (waterLevel < 30) {
        return 'yellow';
    } else if (waterLevel < 50) {
        return 'red';
    } else {
        return 'red';
    }
}