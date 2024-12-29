function initMap() {
    const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 56.942819743474416, lng: 24.17891243732727 },
        zoom: 14,
        // mapId: 'bc02ef078ae8cd67',
        styles: [
            {
                "elementType": "labels",
                "stylers": [
                    {
                        "visibility": "on" // Ensure labels are visible
                    }
                ]
            }
        ],
        mapTypeId: 'hybrid'
    });

    fetch('data/streets.json')
        .then(response => response.json()) // Parse the JSON file
        .then(streetData => {
            // Define the polyline styles for different quality levels
            const polylineOptions = { 
                good: { strokeColor: "#00FF00", strokeOpacity: 0.7, strokeWeight: 3 },
                moderate: { strokeColor: "#FFFF00", strokeOpacity: 0.7, strokeWeight: 3 },
                poor: { strokeColor: "#FF0000", strokeOpacity: 0.7, strokeWeight: 3 },
                notDone: { strokeColor: "#0000FF", strokeOpacity: 0.7, strokeWeight: 3 } 
            };

            // Loop through each street and create a polyline
            streetData.forEach(street => {
                const polyline = new google.maps.Polyline({
                    path: street.path,
                    ...polylineOptions[street.quality],
                    map: map,
                    zIndex: 0
                });

                // Optional: Add an InfoWindow for each street segment
                const infoWindow = new google.maps.InfoWindow({
                    content: `<strong>${street.street_name}</strong><br>
                            Ceļa kvalitāte: ${street.quality === "good" ? "Laba" : street.quality === "moderate" ? "Vidēja" : "Slikta"}<br>
                            Ietve: ${street.sidewalk === true ? "✅" : "❌"}`
                });

                // Display info on click
                polyline.addListener("click", () => {
                    if (window.currentInfoWindow) window.currentInfoWindow.close();
                    infoWindow.setPosition(street.path[Math.floor(street.path.length / 2)]); // Position at midpoint
                    infoWindow.open(map);
                    window.currentInfoWindow = infoWindow;
                });
            });
        })
        .catch(error => {
            console.error("Error loading JSON data:", error);
        });
}

// Ļudoņas iela
// Apmetņu iela