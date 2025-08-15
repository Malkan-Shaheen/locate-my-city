"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

const milesToMeters = mi => Number(mi) * 1609.344;

export default function ResultsPageClient({ query, radiusMiles }) {
  const radiusMeters = useMemo(() => milesToMeters(radiusMiles), [radiusMiles]);

  const [center, setCenter] = useState([31.5204, 74.3587]);
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState(null);
  const [places, setPlaces] = useState([]);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");

  // Fix leaflet icons
  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
      const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
      const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x.src || markerIcon2x,
        iconUrl: markerIcon.src || markerIcon,
        shadowUrl: markerShadow.src || markerShadow,
      });
    })();
  }, []);

  // Fetch data
  useEffect(() => {
    let isCancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const geoRes = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        if (!geoRes.ok) throw new Error("Geocoding failed");
        const g = await geoRes.json();
        if (!g?.lat || !g?.lon) throw new Error("Location not found");
        if (isCancelled) return;

        const lat = Number(g.lat);
        const lon = Number(g.lon);
        setGeo(g);
        setCenter([lat, lon]);

        const [pRes, cRes] = await Promise.all([
          fetch(`/api/places?lat=${lat}&lon=${lon}&radius=${radiusMeters}`),
          fetch(`/api/cities?lat=${lat}&lon=${lon}&radius=${radiusMeters}`),
        ]);

        if (!pRes.ok) throw new Error("Places fetch failed");
        if (!cRes.ok) throw new Error("Cities fetch failed");

        const [pData, cData] = await Promise.all([pRes.json(), cRes.json()]);
        if (isCancelled) return;

        setPlaces(pData || []);
        setCities(cData || []);
      } catch (e) {
        setError(e.message || "Something went wrong");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    if (query.trim()) run();
    else {
      setLoading(false);
      setError("No location provided.");
    }
    return () => {
      isCancelled = true;
    };
  }, [query, radiusMeters]);

  const allMarkers = useMemo(() => {
    const mk = [];
    for (const p of places) if (p.lat && p.lon) mk.push({ ...p, kind: "place" });
    for (const c of cities) if (c.lat && c.lon) mk.push({ ...c, kind: "city" });
    return mk;
  }, [places, cities]);

  return (
    <div className="page-results">
      <Header />
      <main className="container">
        <h1>Results near “{query}” within {radiusMiles} miles</h1>
        {loading && <div>Loading real data…</div>}
        {error && <div>⚠️ {error}</div>}
        {!loading && !error && (
          <>
            {/* Cards */}
            {/* Map */}
            <section className="map-wrap">
              <div className="map">
                <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {allMarkers.map((m) => (
                    <Marker key={`${m.kind}-${m.id}`} position={[m.lat, m.lon]}>
                      <Popup>
                        <strong>{m.name || (m.kind === "city" ? "Settlement" : "Place")}</strong>
                        {m.type || m.place ? <div>{m.type || m.place}</div> : null}
                        {m.address ? <div>{m.address}</div> : null}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
