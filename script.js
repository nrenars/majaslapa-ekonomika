let map; // Reference to the map
let polylines = []; // Store all polylines for easy filtering
let streetData; // Store street data for reuse
let crossingData; // Store zebra crossing data for reuse
let obstacleMarkers = []; // Store obstacle markers for easy toggling
let userLocation; // User's current location or manually selected location
let destinationMarker = null; // Marker for destination
let userLocationMarker = null; // Marker for user location
let destination = null; // Global variable to store the destination

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 56.942819743474416, lng: 24.17891243732727 },
        zoom: 15,
        gestureHandling: 'greedy',
        styles: [
            {
                elementType: "labels",
                stylers: [{ visibility: "on" }]
            }
        ],
        mapTypeId: "hybrid"
    });

    function addMarkers(data) {
        data.forEach((institution) => {
            const marker = new google.maps.Marker({
                position: institution.position,
                map: map,
                title: institution.title,
                icon: {
                    url: institution.icon || "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
                },
            });
    
            const infoWindow = new google.maps.InfoWindow({
                content: institution.infoContent,
            });
    
            marker.addListener("click", () => {
                infoWindow.open(map, marker);
            });
        });
    }

    // Fetch street data, zebra crossing data, and institution data
Promise.all([
    fetch("data/streets.json").then((response) => response.json()),
    fetch("data/crossings.json").then((response) => response.json()),
    fetch("data/institutions.json").then((response) => response.json())
])
    .then(([streetResponse, crossingResponse, institutionResponse]) => {
        // Save data for filtering
        streetData = streetResponse;
        crossingData = crossingResponse;

        // Add markers for institutions
        addMarkers(institutionResponse);

        // Draw polylines
        drawPolylines(streetData, crossingData);
    })
    .catch((error) => {
        console.error("Error loading JSON data:", error);
    });

    // Add event listeners for filters
    document.getElementById("road-quality-filter").addEventListener("change", applyFilters);
    document.getElementById("sidewalk-filter").addEventListener("change", applyFilters);
    document.getElementById("crossing-filter").addEventListener("change", applyFilters);
    document.getElementById("paved-filter").addEventListener("change", applyFilters);
    document.getElementById("obstacle-filter").addEventListener("change", applyFilters);
}

function applyFilters() {
    if (!streetData || !crossingData) {
        console.error("Data not loaded yet");
        return;
    }

    // Get the selected filter values
    const qualityFilter = document.getElementById("road-quality-filter").value || "all";
    const sidewalkFilter = document.getElementById("sidewalk-filter").value || "all";
    const crossingFilter = document.getElementById("crossing-filter").value || "all";
    const pavedFilter = document.getElementById("paved-filter").value || "all";
    const obstacleFilter = document.getElementById("obstacle-filter").value || "all";

    // Filter the street data based on the selected filters
    const filteredStreetData = streetData.filter((street) => {
        const matchesQuality = qualityFilter === "all" || street.quality === qualityFilter;

        const matchesSidewalk = sidewalkFilter === "all" || 
            (sidewalkFilter === "yes" && street.sidewalk) || 
            (sidewalkFilter === "no" && !street.sidewalk);

        const matchesPaved = pavedFilter === "all" || 
            (pavedFilter === "true" && street.paved) || 
            (pavedFilter === "false" && !street.paved);
        
        const hasObstacles = Array.isArray(street.obstacles) && street.obstacles.length > 0;
        const matchesObstacle = obstacleFilter === "all" || 
            (obstacleFilter === "yes" && hasObstacles) || 
            (obstacleFilter === "no" && !hasObstacles);

        return matchesQuality && matchesSidewalk && matchesPaved && matchesObstacle;
    });

    // Filter the crossing data based on the crossingFilter
    const filteredCrossingData = crossingData.filter((crossing) => {
        if (crossingFilter === "all") {
            return true; // Show all crossings
        } else if (crossingFilter === "yes") {
            return crossing.zebra === true; // Show crossings with zebra
        } else if (crossingFilter === "no") {
            return crossing.zebra === false; // Show crossings without zebra
        }
    });

    // Pass the filtered data to the drawing function
    drawPolylines(filteredStreetData, filteredCrossingData);
}
// Adjusted JavaScript Code to Reflect Surface Change

function drawPolylines(streetData, crossingData) {
    polylines.forEach((polyline) => polyline.setMap(null));
    polylines = [];
    obstacleMarkers.forEach((marker) => marker.setMap(null)); // Remove old obstacle markers
    obstacleMarkers = []; 

    const polylineOptions = {
        good: { strokeColor: "#00FF00", strokeOpacity: 0.7, strokeWeight: 3 },
        moderate: { strokeColor: "#FFFF00", strokeOpacity: 0.7, strokeWeight: 3 },
        poor: { strokeColor: "#FF0000", strokeOpacity: 0.7, strokeWeight: 3 },
        notDone: { strokeColor: "#0000FF", strokeOpacity: 0.7, strokeWeight: 3 },
        zebra: { strokeColor: "#FFFFFF", strokeOpacity: 1, strokeWeight: 4 },
        noZebra: { strokeColor: "#000000", strokeOpacity: 1, strokeWeight: 4 },
    };

    streetData.forEach((street) => {
        const hasObstacle = street.obstacles && street.obstacles.length > 0;
        const polyline = new google.maps.Polyline({
            path: street.path,
            ...polylineOptions[street.quality],
            map: map,
            zIndex: 0
        });

        polylines.push(polyline);

        const infoWindowContent = `  
            <strong>${street.street_name}</strong><br>
            Ceļa kvalitāte: ${
                street.quality === "poor" ? "Slikta" : 
                street.quality === "moderate" ? "Vidēja" : 
                "Laba"
            }<br>
            Ietve: ${street.sidewalk ? "✅" : "❌"}<br>
            Virsma: ${street.paved ? "Asfaltēta" : "Neasfaltēta"}
            ${hasObstacle ? `<br>Šķēršļi: ${street.obstacles.map((o) => o.description).join(", ")}` : ""}
        `;

        const infoWindow = new google.maps.InfoWindow({ content: infoWindowContent });

        polyline.addListener("click", () => {
            if (window.currentInfoWindow) window.currentInfoWindow.close();
            infoWindow.setPosition(street.path[Math.floor(street.path.length / 2)]);
            infoWindow.open(map);
            window.currentInfoWindow = infoWindow;
        });

        if (hasObstacle) {
            street.obstacles.forEach((obstacle) => {
                const obstaclePosition = { lat: obstacle.lat, lng: obstacle.lng };

                // Create a marker for the obstacle with a circle icon
                const obstacleMarker = new google.maps.Marker({
                    position: obstaclePosition,
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: "orange",
                        fillOpacity: 1,
                        scale: 8,  // Default scale
                        strokeColor: "black",
                        strokeWeight: 2,
                    },
                    title: "Obstacle",
                });

                const obstacleInfoWindow = new google.maps.InfoWindow({
                    content: `
                        <strong>Obstacle:</strong> ${obstacle.description}<br>
                        <img src="${obstacle.image}" alt="Obstacle image" style="width:100px;">
                    `
                });

                obstacleMarker.addListener("click", () => {
                    if (window.currentInfoWindow) window.currentInfoWindow.close();
                    obstacleInfoWindow.open(map, obstacleMarker);
                    window.currentInfoWindow = obstacleInfoWindow;
                });

                obstacleMarkers.push(obstacleMarker);
            });
        }
    });

    crossingData.forEach((crossing) => {
        const polyline = new google.maps.Polyline({
            path: crossing.path,
            ...polylineOptions[crossing.zebra ? "zebra" : "noZebra"],
            map: map,
            zIndex: 1
        });

        polylines.push(polyline);

        const infoWindow = new google.maps.InfoWindow({
            content: `<strong>${crossing.street_name}</strong><br>
                      Gājēju pāreja: ${crossing.zebra ? "✅" : "❌"}<br>
                      Uzbrauktuve / Nobrauktuve: ${crossing.ramp ? "✅" : "❌"}<br>
                      Luksofors: ${crossing.traffic_light ? "✅" : "❌"}`
        });

        polyline.addListener("click", () => {
            if (window.currentInfoWindow) window.currentInfoWindow.close();
            infoWindow.setPosition(crossing.path[Math.floor(crossing.path.length / 2)]);
            infoWindow.open(map);
            window.currentInfoWindow = infoWindow;
        });
    });

    // Listen for changes in zoom level and update marker size accordingly
    map.addListener("zoom_changed", () => {
        const zoomLevel = map.getZoom();
        const maxScale = 6.5; // Maximum scale size
        const minScale = 4; // Minimum scale size

        // Adjust the scale of the markers based on the zoom level
        obstacleMarkers.forEach((marker) => {
            let scale = Math.max(minScale, Math.min(maxScale, zoomLevel));
            marker.setIcon({
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "orange",
                fillOpacity: 1,
                scale: scale,  // Adjust scale based on zoom level
                strokeColor: "black",
                strokeWeight: 2,
            });
        });
    });
    function addCustomMarker(position, title, infoContent) {
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: title,
            icon: {
                url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
            },
        });
    
        const infoWindow = new google.maps.InfoWindow({
            content: infoContent,
        });
    
        marker.addListener("click", () => {
            infoWindow.open(map, marker);
        });
    }
// Function to get user's location via GPS
// function getUserLocation() {
//     if (navigator.geolocation) {
//         navigator.geolocation.getCurrentPosition(
//             (position) => {
//                 userLocation = {
//                     lat: position.coords.latitude,
//                     lng: position.coords.longitude,
//                 };
//                 console.log("User's location:", userLocation);

//                 // Add or update the user location marker
//                 if (userLocationMarker) {
//                     userLocationMarker.setPosition(userLocation);
//                 } else {
//                     userLocationMarker = new google.maps.Marker({
//                         position: userLocation,
//                         map: map,
//                         title: "Your Location",
//                         icon: {
//                             path: google.maps.SymbolPath.CIRCLE,
//                             scale: 8,
//                             fillColor: "#4285F4",
//                             fillOpacity: 1,
//                             strokeColor: "white",
//                             strokeWeight: 2,
//                         },
//                     });
//                 }

//                 // Center the map on the user's location
//                 map.setCenter(userLocation);
//             },
//             (error) => {
//                 console.error("Error fetching location:", error);
//                 alert("Unable to fetch GPS location. Please set your starting location manually.");
//             }
//         );
//     } else {
//         alert("Geolocation is not supported by this browser.");
//     }
// }

// // Attach the function to the global window object
// window.setStartingLocation = function () {
//     map.addListener("click", (event) => {
//         userLocation = {
//             lat: event.latLng.lat(),
//             lng: event.latLng.lng(),
//         };
//         console.log("Starting location set to:", userLocation);

//         // Add or update the user location marker
//         if (userLocationMarker) {
//             userLocationMarker.setPosition(userLocation);
//         } else {
//             userLocationMarker = new google.maps.Marker({
//                 position: userLocation,
//                 map: map,
//                 title: "Starting Location",
//                 icon: {
//                     path: google.maps.SymbolPath.CIRCLE,
//                     scale: 8,
//                     fillColor: "#4285F4",
//                     fillOpacity: 1,
//                     strokeColor: "white",
//                     strokeWeight: 2,
//                 },
//             });
//         }

//         // Remove the click listener after setting the location
//         google.maps.event.clearListeners(map, "click");
//     });
// };
// // Function to set the destination
// window.setDestination = function () {
//     map.addListener("click", (event) => {
//         destination = {
//             lat: event.latLng.lat(),
//             lng: event.latLng.lng(),
//         };
//         console.log("Destination set to:", destination);

//         // If a destination marker already exists, update its position
//         if (destinationMarker) {
//             destinationMarker.setPosition(destination);
//         } else {
//             // Otherwise, create a new destination marker
//             destinationMarker = new google.maps.Marker({
//                 position: destination,
//                 map: map,
//                 title: "Destination",
//                 icon: {
//                     path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
//                     scale: 8,
//                     fillColor: "#FF0000",
//                     fillOpacity: 1,
//                     strokeColor: "white",
//                     strokeWeight: 2,
//                 },
//             });
//         }
//     });
// };
// // Function to calculate and display the route
// function calculateSafeRoute() {
//     if (!userLocation) {
//         alert("Please set your starting location.");
//         return;
//     }

//     if (!destination) {
//         alert("Please set your destination.");
//         return;
//     }

//     console.log("Calculating route from", userLocation, "to", destination);

//     // Use Google Directions API or your custom logic to calculate the route
//     const directionsService = new google.maps.DirectionsService();
//     const directionsRenderer = new google.maps.DirectionsRenderer({
//         map: map,
//     });

//     directionsService.route(
//         {
//             origin: userLocation,
//             destination: destination,
//             travelMode: google.maps.TravelMode.WALKING,
//         },
//         (result, status) => {
//             if (status === google.maps.DirectionsStatus.OK) {
//                 directionsRenderer.setDirections(result);
//                 console.log("Route:", result);
//             } else {
//                 console.error("Error fetching directions:", status);
//             }
//         }
//     );
// }
// // Function to clear the destination marker
// window.clearDestination = function () {
//     if (destinationMarker) {
//         destinationMarker.setMap(null); // Remove the marker from the map
//         destinationMarker = null; // Clear the reference
//     }
//     destination = null; // Clear the destination variable
//     console.log("Destination cleared");
// };
// window.getUserLocation = getUserLocation;
// window.setDestination = setDestination;
// window.calculateSafeRoute = calculateSafeRoute;

}