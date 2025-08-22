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

// Enhanced place scoring function
function scorePlace(tags) {
  // High priority: Wikipedia/Wikidata entries and major attractions
  if (tags.wikipedia || tags.wikidata) return 10;
  
  // Medium-high priority: Specific attraction types
  if (tags.tourism === "attraction" || tags.historic) return 8;
  
  // Medium priority: Cultural amenities
  if (tags.amenity === "theatre" || tags.amenity === "stadium" || 
      tags.amenity === "museum" ) return 7;
  
  // Named parks and nature reserves (only if they have a proper name)
  if ((tags.leisure === "park" ) && 
      tags.name && tags.name.length > 0) return 6;
  
  // Other leisure facilities
  if (tags.leisure === "golf_course" || tags.leisure === "marina") return 5;
  
  // Low priority: Generic parks without names
  if (tags.leisure === "park" ) return 2;
  
  return 1; // Default low score
}

// Overpass API helper functions
function buildOverpassQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      // Major amenities
      node(around:${radius},${lat},${lon})[amenity~"stadium|theatre|museum"];
      way(around:${radius},${lat},${lon})[amenity~"stadium|theatre|museum"];
      relation(around:${radius},${lat},${lon})[amenity~"stadium|theatre|museum"];
      
      // Important tourist attractions
      node(around:${radius},${lat},${lon})[tourism~"museum|zoo|theme_park|gallery|monument"];
      way(around:${radius},${lat},${lon})[tourism~"museum|zoo|theme_park|gallery|monument"];
      relation(around:${radius},${lat},${lon})[tourism~"museum|zoo|theme_park|gallery|monument"];
      
      // Major leisure facilities (we'll filter parks later)
      node(around:${radius},${lat},${lon})[leisure~"golf_course|marina"];
      way(around:${radius},${lat},${lon})[leisure~"golf_course|marina"];
      relation(around:${radius},${lat},${lon})[leisure~"golf_course|marina"];
      
      // Landmarks and historic sites
      node(around:${radius},${lat},${lon})[historic~"monumenttower"];
      way(around:${radius},${lat},${lon})[historic~"monument|tower"];
      relation(around:${radius},${lat},${lon})[historic~"monument|tower"];
    );
    out center;
  `;
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
      if (r.ok) {
        return r.json();
      }
    } catch (e) {
      continue;
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
      if (json?.elements) {
        all.push(...json.elements);
      }
    } catch (e) {
      // Continue with next chunk if one fails
    }
    start = end;
  }
  return { elements: all };
}

async function fetchPlacesDirectly(lat, lon, radius) {
  try {
    const json = await callOverpassWithChunking(lat, lon, radius, buildOverpassQuery);
    const elements = json.elements || [];
    
    const items = [];
    const seenIds = new Set(); // Track seen place IDs to avoid duplicates
    
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];

      const tags = e.tags || {};
      const latNum = e.lat ?? e.center?.lat;
      const lonNum = e.lon ?? e.center?.lon;

      if (latNum == null || lonNum == null) {
        continue;
      }

      const name =
        tags.name ||
        tags["addr:housename"] ||
        tags["amenity"] ||
        tags["tourism"] ||
        tags["leisure"] ||
        tags["historic"] ||
        "Place";

      // Skip if this is a duplicate
      const placeId = `${e.type}/${e.id}`;
      if (seenIds.has(placeId)) {
        continue;
      }
      seenIds.add(placeId);

      const cLat = Number(lat), cLon = Number(lon);
      const dx = (Number(lonNum) - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (Number(latNum) - cLat) * 110540;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const place = {
        id: placeId,
        name,
        type: tags.amenity || tags.tourism || tags.leisure || tags.historic || "Place",
        lat: Number(latNum),
        lon: Number(lonNum),
        distance,
        address: tags["addr:full"] || tags["addr:street"] || null,
        tags,
        score: scorePlace(tags),
      };

      // Filter out generic parks without names (low score)
      if (place.score >= 8) {
        items.push(place);
      }
    }

    // Sort by score and distance
    items.sort((a, b) =>
      b.score - a.score || a.distance - b.distance
    );

    return items;

  } catch (e) {
    throw new Error("Failed to fetch places: " + e.message);
  }
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
  const [visiblePlaces, setVisiblePlaces] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [visibleCities, setVisibleCities] = useState([]);
  const [loadingMorePlaces, setLoadingMorePlaces] = useState(false);
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
        if (isCancelled) {
          return;
        }

        const lat = Number(g.lat);
        const lon = Number(g.lon);
        setGeo(g);
        setCenter([lat, lon]);

        // Fetch places directly
        setLoadingPlaces(true);
        setVisiblePlaces([]); // Clear any previous places
        
        const places = await fetchPlacesDirectly(lat, lon, radiusMeters);
        if (!isCancelled) {
          setAllPlaces(places);
          setVisiblePlaces(places);
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
              // Filter out duplicate cities using a more robust approach
              const uniqueCities = [];
              const seenCityIds = new Set();
              
              for (const city of data || []) {
                // Create a unique ID using both name and coordinates to avoid duplicates
                const cityId = `${city.name?.toLowerCase().trim()}_${city.lat?.toFixed(4)}_${city.lon?.toFixed(4)}`;
                
                if (cityId && !seenCityIds.has(cityId)) {
                  seenCityIds.add(cityId);
                  uniqueCities.push(city);
                }
              }
              
              setAllCities(uniqueCities);
              // Show first 5 cities immediately
              const initialCities = uniqueCities.slice(0, 5) || [];
              setVisibleCities(initialCities);
            }
          })
          .catch(err => {
            if (!isCancelled) {
              setError("Failed to load cities: " + err.message);
            }
          })
          .finally(() => {
            if (!isCancelled) {
              setLoadingCities(false);
            }
          });

      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Something went wrong");
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
    if (allCities.length > 5 && visibleCities.length < allCities.length) {
      setLoadingMoreCities(true);
      
      let currentIndex = visibleCities.length;
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
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [allCities, visibleCities]);

  const allMarkers = useMemo(() => {
    const mk = [];
    for (const p of visiblePlaces) if (p.lat && p.lon) mk.push({ ...p, kind: "place" });
    for (const c of visibleCities) if (c.lat && c.lon) mk.push({ ...c, kind: "city" });
    return mk;
  }, [visiblePlaces, visibleCities]);

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
                {loadingPlaces && visiblePlaces.length === 0 ? (
                  <div className="muted">Loading places…</div>
                ) : visiblePlaces.length === 0 ? (
                  <div className="muted">No places found in this radius.</div>
                ) : (
                  <>
                    {visiblePlaces.map((p) => (
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
                  <div className="muted">Loading cities...</div>
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
            <h1 id="main-heading" className="main-heading">Discover Nearby Places</h1>
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