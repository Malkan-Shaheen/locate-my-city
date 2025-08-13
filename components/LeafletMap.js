'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LeafletMap = ({ source, destination, distance }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);
  const [mapStatus, setMapStatus] = useState('Loading map...');
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    if (!source || !destination || !mapRef.current) return;

    const cleanup = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      layerRef.current = null;
      setIsInteractive(false);
    };

    cleanup();

    try {
      const map = L.map(mapRef.current, {
        preferCanvas: true,
        zoomControl: true,
        keyboard: true,
        keyboardPanDelta: 75
      }).setView(
        [
          (parseFloat(source.lat) + parseFloat(destination.lat)) / 2,
          (parseFloat(source.lng) + parseFloat(destination.lng)) / 2
        ],
        3
      );

      // Accessible zoom controls
      const zoomContainer = map.zoomControl._container;
      zoomContainer.setAttribute('aria-label', 'Map zoom controls');
      zoomContainer.querySelector('.leaflet-control-zoom-in')
        ?.setAttribute('aria-label', 'Zoom in');
      zoomContainer.querySelector('.leaflet-control-zoom-out')
        ?.setAttribute('aria-label', 'Zoom out');

      mapInstanceRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" aria-label="OpenStreetMap copyright">OpenStreetMap</a>',
        crossOrigin: 'anonymous'
      }).addTo(map);

      const createMarker = (latlng, icon, title, html) =>
        L.marker(latlng, { icon, alt: title, title, riseOnHover: true })
          .bindPopup(html, { className: 'accessible-popup' });

      const sourceIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41]
      });

      const destIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41]
      });

      createMarker(
        [source.lat, source.lng], sourceIcon,
        `Source: ${source.name}`,
        `<div><h3>Source</h3><p>${source.name}</p><p>Lat: ${source.lat}</p><p>Lng: ${source.lng}</p></div>`
      ).addTo(layerRef.current);

      createMarker(
        [destination.lat, destination.lng], destIcon,
        `Destination: ${destination.name}`,
        `<div><h3>Destination</h3><p>${destination.name}</p><p>Lat: ${destination.lat}</p><p>Lng: ${destination.lng}</p></div>`
      ).addTo(layerRef.current);

      const line = L.polyline(
        [[source.lat, source.lng], [destination.lat, destination.lng]],
        { color: 'blue', weight: 2, dashArray: '5,5' }
      ).addTo(layerRef.current);

      const midpoint = line.getBounds().getCenter();
      L.marker(midpoint, {
        icon: L.divIcon({
          html: `<div role="status" aria-live="polite">${distance.toFixed(1)} km<span class="sr-only"> Distance</span></div>`,
          className: 'distance-label-container',
          iconSize: [100, 30]
        }),
        keyboard: false
      }).addTo(layerRef.current);

      map.fitBounds([[source.lat, source.lng], [destination.lat, destination.lng]], { padding: [50, 50] });

      setMapStatus(`Map loaded showing route from ${source.name} to ${destination.name}`);
      setIsInteractive(true);

      map.whenReady(() => {
        mapRef.current.setAttribute('aria-busy', 'false');
        mapRef.current.focus();
      });
    } catch (err) {
      setMapStatus('Error loading map. Please try again.');
      console.error(err);
    }

    return cleanup;
  }, [source, destination, distance]);

  return (
    <div
      ref={mapRef}
      style={{ height: '500px', width: '100%', borderRadius: '8px', position: 'relative' }}
      role="application"
      aria-label={`Interactive map ${mapStatus}`}
      aria-live="polite"
      tabIndex={0}
    >
      <div className="sr-only" aria-live="assertive">{mapStatus}</div>
      {!isInteractive && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1000
        }}>
          <p>{mapStatus}</p>
        </div>
      )}
    </div>
  );
};

export default LeafletMap;

