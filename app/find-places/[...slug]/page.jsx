"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
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

// Overpass API helper functions
function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      // Major amenities
      node(around:${radius},${lat},${lon})[amenity~"university|stadium|theatre|museum|library"];
      way(around:${radius},${lat},${lon})[amenity~"university|stadium|theatre|museum|library"];
      relation(around:${radius},${lat},${lon})[amenity~"university|stadium|theatre|museum|library"];
      
      // Important tourist attractions
      node(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|theme_park|gallery|monument|castle"];
      way(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|theme_park|gallery|monument|castle"];
      relation(around:${radius},${lat},${lon})[tourism~"attraction|museum|zoo|theme_park|gallery|monument|castle"];
      
      // Major leisure facilities
      node(around:${radius},${lat},${lon})[leisure~"park|nature_reserve|golf_course|marina"];
      way(around:${radius},${lat},${lon})[leisure~"park|nature_reserve|golf_course|marina"];
      relation(around:${radius},${lat},${lon})[leisure~"park|nature_reserve|golf_course|marina"];
      
      // Landmarks and historic sites
      node(around:${radius},${lat},${lon})[historic~"monument|castle|fort|tower"];
      way(around:${radius},${lat},${lon})[historic~"monument|castle|fort|tower"];
      relation(around:${radius},${lat},${lon})[historic~"monument|castle|fort|tower"];
    );
    out center;
  `;
}

function scorePlace(tags) {
  if (tags.wikipedia || tags.wikidata) return 5; // globally notable
  if (tags.tourism === "attraction" || tags.historic) return 4; // tourist/historic spots
  if (tags.amenity === "theatre" || tags.amenity === "stadium" || tags.amenity === "museum") return 3;
  if (tags.leisure === "park" || tags.leisure === "nature_reserve") return 2;
  return 1; // default
}

function maxResultsForRadius(miles) {
  if (miles <= 10) return 7;
  if (miles <= 20) return 12;
  if (miles <= 50) return 20;
  if (miles <= 100) return 30;
  if (miles <= 200) return 40;
  if (miles <= 500) return 50;
  return 50;
}

async function callOverpassQuery(q) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (r.ok) return r.json();
    } catch (e) {
      console.error("Overpass failed at", ep, e);
    }
  }
  throw new Error("All Overpass endpoints failed");
}

async function callOverpassWithChunking(lat, lon, radius, qBuilder) {
  // if radius ≤ 300km, single query
  if (radius <= 300000) {
    const q = qBuilder(lat, lon, radius);
    return callOverpassQuery(q);
  }

  // otherwise split into 250km steps
  const step = 250000;
  let start = 0;
  const all = [];
  while (start < radius) {
    const end = Math.min(start + step, radius);
    const q = qBuilder(lat, lon, end);
    try {
      const json = await callOverpassQuery(q);
      if (json?.elements) all.push(...json.elements);
    } catch (e) {
      console.warn(`Chunk ${start}-${end} failed`, e);
    }
    start = end;
  }
  return { elements: all };
}

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
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [geo, setGeo] = useState(null);

  // 👇 main states
  const [allPlaces, setAllPlaces] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [visibleCities, setVisibleCities] = useState([]);
  const [loadingMoreCities, setLoadingMoreCities] = useState(false);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  // Configure leaflet icons
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
      
      setMapReady(true);
    })();
  }, []);

  // Fetch geo + places + cities
  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      try {
        setError("");

        if (!query) {
          throw new Error("No location provided");
        }

        // Fetch geocode
        const geoRes = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        if (!geoRes.ok) throw new Error("Geocoding failed");
        const g = await geoRes.json();
        if (!g?.lat || !g?.lon) throw new Error("Location not found");
        if (isCancelled) return;

        const lat = Number(g.lat);
        const lon = Number(g.lon);
        setGeo(g);
        setCenter([lat, lon]);

        // Fetch places directly from Overpass API
        setLoadingPlaces(true);
        
        // Build and execute Overpass query
        const overpassQuery = buildOverpassQuery(lat, lon, radiusMeters);
        const json = await callOverpassWithChunking(lat, lon, radiusMeters, buildOverpassQuery);
        
        if (isCancelled) return;
        
        const elements = json.elements || [];
        const cLat = Number(lat), cLon = Number(lon);
        
        // Process and add places one by one
        for (const e of elements) {
          if (isCancelled) break;
          
          const tags = e.tags || {};
          const latNum = e.lat ?? e.center?.lat;
          const lonNum = e.lon ?? e.center?.lon;
          if (latNum == null || lonNum == null) continue;

          const name =
            tags.name ||
            tags["addr:housename"] ||
            tags["amenity"] ||
            tags["tourism"] ||
            tags["leisure"] ||
            "Place";

          // Calculate distance
          const dx = (Number(lonNum) - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
          const dy = (Number(latNum) - cLat) * 110540;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const place = {
            id: `${e.type}/${e.id}`,
            name,
            type: tags.amenity || tags.tourism || tags.leisure || tags.historic || "Place",
            lat: Number(latNum),
            lon: Number(lonNum),
            distance,
            address: tags["addr:full"] || tags["addr:street"] || null,
            tags, // keep tags for scoring
          };

          // Add place to list immediately
          setAllPlaces(prev => {
            const newPlaces = [...prev, place];
            
            // Sort by score and distance
            newPlaces.sort((a, b) =>
              scorePlace(b.tags) - scorePlace(a.tags) || a.distance - b.distance
            );
            
            // Limit results based on radius
            const miles = radiusMeters / 1609.344;
            const maxResults = maxResultsForRadius(miles);
            
            return newPlaces.slice(0, maxResults);
          });
        }

        setLoadingPlaces(false);

        // Fetch cities (still using API endpoint)
        setLoadingCities(true);
        fetch(`/api/cities?lat=${lat}&lon=${lon}&radius=${radiusMeters}`)
          .then(res => {
            if (!res.ok) throw new Error("Cities fetch failed");
            return res.json();
          })
          .then(data => {
            if (!isCancelled) {
              setAllCities(data || []);
              // Show first 5 cities immediately
              setVisibleCities(data.slice(0, 5) || []);
            }
          })
          .catch(err => {
            if (!isCancelled) console.error("Cities fetch error:", err);
          })
          .finally(() => {
            if (!isCancelled) setLoadingCities(false);
          });

      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Something went wrong");
          console.error("Fetch error:", err);
        }
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [query, radiusMeters]);

  // Progressive loading for cities
  useEffect(() => {
    if (allCities.length > 5) {
      setLoadingMoreCities(true);
      
      let currentIndex = 5;
      const totalItems = allCities.length;
      
      const loadNextBatch = () => {
        if (currentIndex >= totalItems) {
          setLoadingMoreCities(false);
          return;
        }
        
        const nextBatch = allCities.slice(0, currentIndex + 5);
        setVisibleCities(nextBatch);
        currentIndex += 5;
        
        // Schedule next batch
        setTimeout(loadNextBatch, 800);
      };
      
      // Start loading batches after initial display
      const timer = setTimeout(loadNextBatch, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [allCities]);

  const allMarkers = useMemo(() => {
    const mk = [];
    for (const p of allPlaces) if (p.lat && p.lon) mk.push({ ...p, kind: "place" });
    for (const c of allCities) if (c.lat && c.lon) mk.push({ ...c, kind: "city" });
    return mk;
  }, [allPlaces, allCities]);

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

      {(loadingPlaces || loadingCities) && (
        <div className="info">
          {loadingPlaces && "Loading places… "}
          {loadingCities && "Loading cities…"}
        </div>
      )}
      {error && <div className="error">⚠️ {error}</div>}

      {!error && (
        <>
          <section className="cards">
            <div className="card">
              <div className="card-header">
                <h2>Nearby Places</h2>
                <span className="badge">{allPlaces.length}</span>
              </div>

              <div className="card-body">
                {loadingPlaces && allPlaces.length === 0 ? (
                  <div className="muted">Loading places…</div>
                ) : allPlaces.length === 0 ? (
                  <div className="muted">No places found in this radius.</div>
                ) : (
                  <>
                    {allPlaces.map((p) => (
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
                    ))}
                    {loadingPlaces && <div className="muted">Loading more places…</div>}
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Nearby Cities/Towns</h2>
                <span className="badge">{allCities.length}</span>
              </div>

              <div className="card-body">
                {loadingCities && visibleCities.length === 0 ? (
                  <div className="muted">Loading cities…</div>
                ) : visibleCities.length === 0 ? (
                  <div className="muted">No cities/towns found in this radius.</div>
                ) : (
                  <>
                    {visibleCities.map((c) => (
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
                    ))}
                    {loadingMoreCities && <div className="muted">Loading more cities…</div>}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="map-wrap">
            <div className="map">
              {mapReady && (
                <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
              )}
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
        <main id="main-content" >
      <section className="hero-banner" aria-labelledby="main-heading" aria-describedby="hero-desc">
          <div className="content-container">
            <h1 id="main-heading" className="main-heading">Discover Nerby Places</h1>
            <p id="hero-desc" className="hero-subtitle">Enter a location and search radius to explore cities,
                landmarks, and hidden gems near you.</p>
          </div>
        </section></main>
      <main className="container">
        <Suspense fallback={<div className="info">Loading search parameters...</div>}>
          <ResultsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}