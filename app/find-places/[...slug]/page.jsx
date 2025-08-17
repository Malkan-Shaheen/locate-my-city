"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
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

function ResultsContent() {
  
  // Safely extract parameters with proper fallbacks
  const params = useParams();
const slugArray = params?.slug || [];

// defaults
let radius = "10";
let location = "";

if (slugArray[0]) {
  const match = slugArray[0].match(/places-(\d+)-miles-from-(.+)/);
  if (match) {
    radius = match[1];
    location = decodeURIComponent(match[2]);
  }
}

const query = location.trim();
  const radiusMeters = useMemo(() => milesToMeters(radius), [radius]);

  const [center, setCenter] = useState([31.5204, 74.3587]); // Default to Islamabad
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState(null);
  const [places, setPlaces] = useState([]);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("Route params:", { radius, location, query }); // Debugging
  }, [radius, location, query]);

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

  useEffect(() => {
    let isCancelled = false;
    
    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        
        if (!query) {
          throw new Error("No location provided");
        }

        // Fetch geocode data
        const geoRes = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        if (!geoRes.ok) throw new Error("Geocoding failed");
        const g = await geoRes.json();
        if (!g?.lat || !g?.lon) throw new Error("Location not found");
        if (isCancelled) return;

        const lat = Number(g.lat);
        const lon = Number(g.lon);
        setGeo(g);
        setCenter([lat, lon]);

        // Fetch places and cities in parallel
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
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Something went wrong");
          console.error("Fetch error:", err);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchData();

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

  const createSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  return (
    <>
      <h1 className="title">
        Results near "{query}" within {radius} miles
      </h1>

      {loading && <div className="info">Loading real data…</div>}
      {error && <div className="error">⚠️ {error}</div>}

      {!loading && !error && (
        <>
          <section className="cards">
            <div className="card">
              <div className="card-header">
                <h2>Nearby Places</h2>
                <span className="badge">{places.length}</span>
              </div>

              <div className="card-body">
                {places.length === 0 ? (
                  <div className="muted">No places found in this radius.</div>
                ) : (
                  places.map((p) => (
                    <Link 
                      key={`place-${p.id}`} 
                      href={`/how-far-is-${createSlug(p.name || "Unnamed place")}-from-me`}
                      className="result-link"
                    >
                      <div className="result-section">
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
                              <dd>{(p.distance / 1609.344).toFixed(1)} miles</dd>
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
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Nearby Cities/Towns</h2>
                <span className="badge">{cities.length}</span>
              </div>

              <div className="card-body">
                {cities.length === 0 ? (
                  <div className="muted">No cities/towns found in this radius.</div>
                ) : (
                  cities.map((c) => (
                    <Link 
                      key={`city-${c.id}`} 
                      href={`/how-far-is-${createSlug(c.name || "Unnamed settlement")}-from-me`}
                      className="result-link"
                    >
                      <div className="result-section">
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
                              <dd>{(c.distance / 1609.344).toFixed(1)} miles</dd>
                            </>
                          )}
                          <dt>Coords</dt>
                          <dd>
                            {c.lat.toFixed(5)}, {c.lon.toFixed(5)}
                          </dd>
                        </dl>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </section>

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
                      <br />
                      <span>{(m.distance / 1609.344).toFixed(1)} miles away</span>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </section>
        </>
      )}

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
        .result-link { display: block; text-decoration: none; color: inherit; }
        .result-section { border: 1px solid #f0f0f0; border-radius: 12px; padding: 10px 12px; margin-bottom: 10px; background: #fafafa; transition: all 0.2s ease; }
        .result-section:hover { background: #f0f0f0; cursor: pointer; }
        .result-title { font-size: 16px; margin: 0 0 6px; }
        .result-meta { display: grid; grid-template-columns: 90px 1fr; gap: 4px 10px; }
        .result-meta dt { color: #6b7280; }
        .result-meta dd { margin: 0; }
        .map-wrap { margin-top: 18px; }
        .map { width: 100%; height: 520px; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }
      `}</style>
    </>
  );
}

export default function ResultsPage() {
  return (
    <div className="page-results">
      <Header />
      <main className="container">
        <Suspense fallback={<div className="info">Loading search parameters...</div>}>
          <ResultsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}