'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map({ sourceCoords, destinationCoords, distance }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Create map instance with world view
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: true,
      worldCopyJump: true,
    });

    // Add tile layer with neutral map style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      minZoom: 2,
      maxZoom: 8,
    }).addTo(mapInstance.current);

    // Set initial view
    mapInstance.current.setView([30, 0], 2);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update markers and polyline when coordinates change
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear previous markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Remove previous polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
    }

    // Marker helper
    const createMarker = (coords, color, label) => {
      return L.circleMarker([coords.lat, coords.lng], {
        radius: 6,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(mapInstance.current)
        .bindPopup(label);
    };

    // Add markers
    if (destinationCoords) {
      const destMarker = createMarker(
        destinationCoords,
        '#ff0000',
        `Destination (${destinationCoords.lat.toFixed(2)}, ${destinationCoords.lng.toFixed(2)})`
      );
      markersRef.current.push(destMarker);
    }

    if (sourceCoords) {
      const sourceMarker = createMarker(
        sourceCoords,
        '#4682B4',
        `Your Location (${sourceCoords.lat.toFixed(2)}, ${sourceCoords.lng.toFixed(2)})`
      );
      markersRef.current.push(sourceMarker);
    }

    // Add simple line between points if both exist
    if (destinationCoords && sourceCoords) {
      polylineRef.current = L.polyline(
        [
          [sourceCoords.lat, sourceCoords.lng],
          [destinationCoords.lat, destinationCoords.lng],
        ],
        {
          color: '#4682B4',
          weight: 2,
          dashArray: '5, 5',
        }
      ).addTo(mapInstance.current);

      mapInstance.current.fitBounds(
        [
          [sourceCoords.lat, sourceCoords.lng],
          [destinationCoords.lat, destinationCoords.lng],
        ],
        { padding: [50, 50] }
      );
    } else if (destinationCoords) {
      mapInstance.current.setView([destinationCoords.lat, destinationCoords.lng], 4);
    } else if (sourceCoords) {
      mapInstance.current.setView([sourceCoords.lat, sourceCoords.lng], 4);
    } else {
      mapInstance.current.setView([30, 0], 2);
    }
  }, [sourceCoords, destinationCoords, distance]);

  return (
    <div
      ref={mapRef}
      style={{
        height: '100%',
        width: '100%',
        borderRadius: '10px',
        minHeight: '400px',
        backgroundColor: '#f5f5f5',
      }}
    />
  );
}
