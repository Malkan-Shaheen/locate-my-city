'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MapWithNoSSR = dynamic(
  () => import('leaflet').then((L) => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/images/marker-icon-2x.png',
      iconUrl: '/images/marker-icon.png',
      shadowUrl: '/images/marker-shadow.png',
    });

    return function MapComponent({ setMap, userLatitude, userLongitude, destinationPlace }) {
      const mapRef = useRef(null);
      const userMarkerRef = useRef(null);
      const destMarkerRef = useRef(null);
      const routeLineRef = useRef(null);

      useEffect(() => {
        if (mapRef.current) return;

        const mapInstance = L.map('map', {
          center: [20, 0],
          zoom: 2,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);

        mapInstance.whenReady(() => {
          mapInstance.invalidateSize();
        });

        mapRef.current = mapInstance;
        setMap(mapInstance);

        return () => {
          mapInstance.remove();
          mapRef.current = null;
        };
      }, []);

      useEffect(() => {
        if (!mapRef.current || !userLatitude || !userLongitude) return;

        const userIcon = L.divIcon({
          className: 'user-location-icon',
          html: '<i class="fas fa-map-marker-alt" style="color: #4682B4; font-size: 32px;"></i>',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([userLatitude, userLongitude]);
        } else {
          userMarkerRef.current = L.marker([userLatitude, userLongitude], { icon: userIcon })
            .addTo(mapRef.current);
        }
      }, [userLatitude, userLongitude]);

      useEffect(() => {
        if (!mapRef.current || !destinationPlace || !userLatitude || !userLongitude) return;

        const destLat = parseFloat(destinationPlace.lat);
        const destLon = parseFloat(destinationPlace.lon);

        const destIcon = L.divIcon({
          className: 'destination-location-icon',
          html: '<i class="fas fa-map-marker-alt" style="color: #1E40AF; font-size: 32px;"></i>',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });

        if (destMarkerRef.current) {
          destMarkerRef.current.setLatLng([destLat, destLon]);
        } else {
          destMarkerRef.current = L.marker([destLat, destLon], { icon: destIcon })
            .addTo(mapRef.current);
        }

        if (routeLineRef.current) {
          mapRef.current.removeLayer(routeLineRef.current);
        }

        routeLineRef.current = L.polyline(
          [[userLatitude, userLongitude], [destLat, destLon]],
          { color: '#4682B4', weight: 3, dashArray: '5, 5' }
        ).addTo(mapRef.current);

        const bounds = L.latLngBounds([
          [userLatitude, userLongitude],
          [destLat, destLon]
        ]);

        mapRef.current.fitBounds(bounds, { padding: [50, 50] });

      }, [destinationPlace]);

      return (
        <div
          id="map"
          style={{
            width: '100%',
            height: '350px',
            minHeight: '300px',
            marginTop: '20px',
            borderRadius: '12px',
            border: '1px solid #ddd'
          }}
        />
      );
    };
  }),
  { ssr: false }
);

export default MapWithNoSSR;
