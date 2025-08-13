// components/MapComponent.js
'use client';
import { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapComponent({ locations }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;

    // Fix icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const mapInstance = L.map(mapRef.current, {
      zoomControl: false,
      dragging: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      touchZoom: false,
    }).setView([37.8, -96], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance);

    mapInstanceRef.current = mapInstance;

    return () => {
      mapInstance.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !locations) return;

    markersRef.current.forEach(marker => mapInstanceRef.current.removeLayer(marker));
    markersRef.current = [];

    locations.forEach(location => {
      const marker = L.marker([location.lat, location.lon])
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${location.name}</b><br>${location.county}, ${location.state}`);
      markersRef.current.push(marker);
    });

    if (locations.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
    }
  }, [locations]);

  return <div ref={mapRef} style={{ height: '500px', borderRadius: '12px', width: '100%' }} />;
}