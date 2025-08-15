"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import "leaflet/dist/leaflet.css";

// Dynamically import react-leaflet (avoids SSR issues)
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

const milesToMeters = (mi) => Number(mi) * 1609.344;

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("location") || "";
  const radiusMiles = searchParams.get("radius") || "10";
  const radiusMeters = useMemo(() => milesToMeters(radiusMiles), [radiusMiles]);

  const [center, setCenter] = useState([31.5204, 74.3587]);
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState(null);
  const [places, setPlaces] = useState([]);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");

  // ✅ Import Leaflet and fix marker icons only on client
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
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

  // Geocoding + data fetch logic
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
        <h1 className="title">
          Results near “{query}” within {radiusMiles} miles
        </h1>

        {loading && <div className="info">Loading real data…</div>}
        {error && <div className="error">⚠️ {error}</div>}

        {!loading && !error && (
          <>
            {/* Two cards side-by-side on wide screens, stacked on mobile */}
            <section className="cards">
              {/* PLACES CARD */}
              <div className="card">
                <div className="card-header">
                  <h2>Nearby Places</h2>
                  <span className="badge">{places.length}</span>
                </div>

                <div className="card-body">
                  {places.length === 0 && (
                    <div className="muted">No places found in this radius.</div>
                  )}

                  {places.map((p) => (
                    <div key={`place-${p.id}`} className="result-section">
                      <h3 className="result-title">{p.name || "Unnamed place"}</h3>
                      <dl className="result-meta">
                        {p.type && (
                          <>
                            <dt>Type</dt>
                            <dd>{p.type}</dd>
                          </>
                        )}
                        {p.distance != null && (
                          <>
                            <dt>Distance</dt>
                            <dd>{p.distance.toFixed(1)} m</dd>
                          </>
                        )}
                        {p.address && (
                          <>
                            <dt>Address</dt>
                            <dd>{p.address}</dd>
                          </>
                        )}
                        <dt>Coords</dt>
                        <dd>
                          {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                        </dd>
                      </dl>
                    </div>
                  ))}
                </div>
              </div>

              {/* CITIES CARD */}
              <div className="card">
                <div className="card-header">
                  <h2>Nearby Cities/Towns</h2>
                  <span className="badge">{cities.length}</span>
                </div>

                <div className="card-body">
                  {cities.length === 0 && (
                    <div className="muted">No cities/towns found in this radius.</div>
                  )}

                  {cities.map((c) => (
                    <div key={`city-${c.id}`} className="result-section">
                      <h3 className="result-title">{c.name || "Unnamed settlement"}</h3>
                      <dl className="result-meta">
                        {c.place && (
                          <>
                            <dt>Place</dt>
                            <dd>{c.place}</dd>
                          </>
                        )}
                        {c.distance != null && (
                          <>
                            <dt>Distance</dt>
                            <dd>{c.distance.toFixed(1)} m</dd>
                          </>
                        )}
                        <dt>Coords</dt>
                        <dd>
                          {c.lat.toFixed(5)}, {c.lon.toFixed(5)}
                        </dd>
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* MAP BELOW THE TWO CARDS */}
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
                        <br />
                        {m.type || m.place ? <span>{m.type || m.place}</span> : null}
                        <br />
                        {m.address ? <span>{m.address}</span> : null}
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

      {/* Minimal styles (tweak or move to your CSS file) */}
      <style jsx>{`
        .container { padding: 24px; max-width: 1200px; margin: 0 auto; }
        .title { font-size: 22px; font-weight: 700; margin-bottom: 16px; }
        .info { padding: 12px 14px; background: #f6f7fb; border: 1px solid #e5e7eb; border-radius: 10px; }
        .error { padding: 12px 14px; background: #fff2f2; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; }
        .cards { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 992px) { .cards { grid-template-columns: 1fr 1fr; } }
        .card { background: #fff; border: 1px solid #ececec; border-radius: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.05); overflow: hidden; }
        .card-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #f1f1f1; }
        .card-header h2 { font-size: 18px; margin: 0; }
        .badge { font-size: 12px; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 4px 8px; border-radius: 999px; }
        .card-body { padding: 12px 16px; max-height: 480px; overflow: auto; }
        .result-section { border: 1px solid #f0f0f0; border-radius: 12px; padding: 10px 12px; margin-bottom: 10px; background: #fafafa; }
        .result-title { font-size: 16px; margin: 0 0 6px; }
        .result-meta { display: grid; grid-template-columns: 90px 1fr; gap: 4px 10px; }
        .result-meta dt { color: #6b7280; }
        .result-meta dd { margin: 0; }
        .map-wrap { margin-top: 18px; }
        .map { width: 100%; height: 520px; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }
      `}</style>
    </div>
  );
}
    