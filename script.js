let map; // Reference to the map
let polylines = []; // Store all polylines for easy filtering
let streetData; // Store street data for reuse
let crossingData; // Store zebra crossing data for reuse
let obstacleMarkers = []; // Store obstacle markers for easy toggling

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

    // Fetch street data and zebra crossing data
    Promise.all([
        fetch("data/streets.json").then((response) => response.json()),
        fetch("data/crossings.json").then((response) => response.json())
    ])
    .then(([streetResponse, crossingResponse]) => {
        streetData = streetResponse; // Save for filtering
        crossingData = crossingResponse; // Save for filtering
        drawPolylines(streetData, crossingData);
    })
    .catch((error) => console.error("Error loading JSON data:", error));

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
}