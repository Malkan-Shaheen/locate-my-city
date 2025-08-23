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
const Circle = dynamic(
  () => import("react-leaflet").then((m) => m.Circle),
  { ssr: false }
);

const milesToMeters = (mi) => Number(mi) * 1609.344;

// Overpass API helper functions
function buildCitiesQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      node(around:${radius},${lat},${lon})["place"~"city"];
      way(around:${radius},${lat},${lon})["place"~"city"];
      relation(around:${radius},${lat},${lon})["place"~"city"];
    );
    out center;
  `;
}

function buildTownsQuery(lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      node(around:${radius},${lat},${lon})["place"~"town"];
      way(around:${radius},${lat},${lon})["place"~"town"];
      relation(around:${radius},${lat},${lon})["place"~"town"];
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

async function fetchCitiesDirectly(lat, lon, radius) {
  try {
    const json = await callOverpassWithChunking(lat, lon, radius, buildCitiesQuery);
    const elements = json.elements || [];
    
    const items = [];
    const seenIds = new Set();
    
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];

      const tags = e.tags || {};
      const latNum = e.lat ?? e.center?.lat;
      const lonNum = e.lon ?? e.center?.lon;

      if (latNum == null || lonNum == null) {
        continue;
      }

      const name = tags.name || "Unnamed settlement";
      const placeType = tags.place || "settlement";

      // Skip if this is a duplicate
      const placeId = `${name.toLowerCase()}_${latNum.toFixed(4)}_${lonNum.toFixed(4)}`;
      if (seenIds.has(placeId)) {
        continue;
      }
      seenIds.add(placeId);

      const cLat = Number(lat), cLon = Number(lon);
      const dx = (Number(lonNum) - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (Number(latNum) - cLat) * 110540;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Filter out the search area itself
      if (distance < 1000) continue;

      // Filter out places outside the defined radius (convert to meters)
      if (distance > radius) continue;

      const item = {
        id: placeId,
        name,
        type: placeType,
        lat: Number(latNum),
        lon: Number(lonNum),
        distance,
      };

      items.push(item);
    }

   items.sort((a, b) => a.distance - b.distance);

    return items;

  } catch (e) {
    throw new Error("Failed to fetch cities: " + e.message);
  }
}

async function fetchTownsDirectly(lat, lon, radius) {
  try {
    const json = await callOverpassWithChunking(lat, lon, radius, buildTownsQuery);
    const elements = json.elements || [];
    
    const items = [];
    const seenIds = new Set();
    
    for (let i = 0; i < elements.length; i++) {
      const e = elements[i];

      const tags = e.tags || {};
      const latNum = e.lat ?? e.center?.lat;
      const lonNum = e.lon ?? e.center?.lon;

      if (latNum == null || lonNum == null) {
        continue;
      }

      const name = tags.name || "Unnamed settlement";
      const placeType = tags.place || "settlement";

      // Skip if this is a duplicate or a city (we already have cities)
      if (placeType === "city") continue;
      
      const placeId = `${name.toLowerCase()}_${latNum.toFixed(4)}_${lonNum.toFixed(4)}`;
      if (seenIds.has(placeId)) {
        continue;
      }
      seenIds.add(placeId);

      const cLat = Number(lat), cLon = Number(lon);
      const dx = (Number(lonNum) - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const dy = (Number(latNum) - cLat) * 110540;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Filter out the search area itself
      if (distance < 1000) continue;

      // Filter out places outside the defined radius (convert to meters)
      if (distance > radius) continue;

      const item = {
        id: placeId,
        name,
        type: placeType,
        lat: Number(latNum),
        lon: Number(lonNum),
        distance,
      };

      items.push(item);
    }

    // Sort by type then distance
    items.sort((a, b) => a.distance - b.distance);

    return items;


  } catch (e) {
    throw new Error("Failed to fetch towns: " + e.message);
  }
}

// Function to convert non-English city names to English
async function translateCityName(name) {
  try {
    // If the name contains only ASCII characters, assume it's already in English
    if (/^[\x00-\x7F]*$/.test(name)) {
      return name;
    }
    
    // Try to translate using a simple API (you might want to use a proper translation service)
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(name)}&langpair=auto|en`);
    const data = await response.json();
    
    if (data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    
    return name; // Fallback to original name if translation fails
  } catch (error) {
    console.error("Translation error:", error);
    return name; // Fallback to original name
  }
}

// NEW: Simple MapFocusController that uses a more reliable approach
function MapFocusController({ center, radiusMeters, map }) {
  useEffect(() => {
    if (center && radiusMeters && map) {
      // Use a timeout to ensure the map is fully initialized
      const timer = setTimeout(() => {
        try {
          // Calculate bounds manually instead of using circle.getBounds()
          const lat = center[0];
          const lon = center[1];
          
          // Convert radius from meters to degrees (approximate)
          const latDelta = (radiusMeters / 111320) * (1 / Math.cos(lat * Math.PI / 180));
          const lonDelta = radiusMeters / 111320;
          
          // Create bounds manually
          const bounds = [
            [lat - latDelta, lon - lonDelta],
            [lat + latDelta, lon + lonDelta]
          ];
          
          // Fit the map to these bounds
          map.fitBounds(bounds, { padding: [20, 20] });
        } catch (error) {
          console.error("Error fitting map bounds:", error);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [center, radiusMeters, map]);
  
  return null;
}

// NEW: Custom Map Wrapper to get the map instance
function CustomMapWrapper({ center, radiusMeters, children, ...props }) {
  const [map, setMap] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Get the map instance once it's available
  const MapRef = () => {
    const mapInstance = dynamic(
      () => import("react-leaflet").then((m) => {
        const { useMap } = m;
        return function MapRef() {
          const map = useMap();
          useEffect(() => {
            setMap(map);
            // Wait for map to be fully initialized
            const timer = setTimeout(() => {
              setMapReady(true);
            }, 100);
            return () => clearTimeout(timer);
          }, [map]);
          return null;
        };
      }),
      { ssr: false }
    );
    return mapInstance ? <MapRef /> : null;
  };

  return (
    <MapContainer ref={setMap} {...props}>
      <MapRef />
      {children}
      {mapReady && (
        <MapFocusController 
          center={center} 
          radiusMeters={radiusMeters} 
          map={map} 
        />
      )}
    </MapContainer>
  );
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
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);
  const [geo, setGeo] = useState(null);

  // 👇 main states
  const [allCities, setAllCities] = useState([]);
  const [visibleCities, setVisibleCities] = useState([]);
  const [allTowns, setAllTowns] = useState([]);
  const [visibleTowns, setVisibleTowns] = useState([]);
  const [loadingMoreCities, setLoadingMoreCities] = useState(false);
  const [loadingMoreTowns, setLoadingMoreTowns] = useState(false);
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

  // Fetch geo + cities + towns
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

        // Fetch cities and towns simultaneously
        setLoadingCities(true);
        setLoadingTowns(true);
        
        setVisibleCities([]); // Clear any previous data
        setVisibleTowns([]);
        
        // Start both requests at the same time
        Promise.all([
          fetchCitiesDirectly(lat, lon, radiusMeters),
          fetchTownsDirectly(lat, lon, radiusMeters)
        ]).then(([cities, towns]) => {
          if (!isCancelled) {
            setAllCities(cities);
            setAllTowns(towns);
            
            // Show first 5 cities immediately
            const initialCities = cities.slice(0, 5) || [];
            setVisibleCities(initialCities);
            
            // Show first 5 towns immediately
            const initialTowns = towns.slice(0, 5) || [];
            setVisibleTowns(initialTowns);
          }
        }).catch(err => {
          if (!isCancelled) {
            setError("Failed to load data: " + err.message);
          }
        }).finally(() => {
          if (!isCancelled) {
            setLoadingCities(false);
            setLoadingTowns(false);
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

  // Progressive loading for towns
  useEffect(() => {
    if (allTowns.length > 5 && visibleTowns.length < allTowns.length) {
      setLoadingMoreTowns(true);
      
      let currentIndex = visibleTowns.length;
      const totalItems = allTowns.length;
      
      const loadNextBatch = () => {
        if (currentIndex >= totalItems) {
          setLoadingMoreTowns(false);
          return;
        }
        
        const nextBatch = allTowns.slice(0, currentIndex + 5);
        setVisibleTowns(nextBatch);
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
  }, [allTowns, visibleTowns]);

  const allMarkers = useMemo(() => {
    const mk = [];
    for (const c of visibleCities) if (c.lat && c.lon) mk.push({ ...c, kind: "city" });
    for (const t of visibleTowns) if (t.lat && t.lon) mk.push({ ...t, kind: "town" });
    return mk;
  }, [visibleCities, visibleTowns]);

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

      {(loadingCities || loadingTowns) && (
        <div className="info">
          {loadingCities && "Loading cities… "}
          {loadingTowns && "Loading towns…"}
        </div>
      )}
      {error && <div className="error">⚠️ {error}</div>}

      {!error && (
        <>
          <section className="cards">
            <div className="card">
              <div className="card-header">
                <h2>Nearby Cities</h2>
                <span className="badge">{allCities.length}</span>
              </div>

              <div className="card-body">
                {loadingCities && visibleCities.length === 0 ? (
                  <div className="muted">Loading cities…</div>
                ) : visibleCities.length === 0 ? (
                  <div className="muted">No cities found in this radius.</div>
                ) : (
                  <>
                    {visibleCities.map((c) => (
                      <Link 
                        key={`city-${c.id}`} 
                        href={`/how-far-is-${createSlug(c.name)}-from-me`}
                        className="result-link"
                      >
                        <div className="result-section">
                          <h3 className="result-title">{c.name}</h3>
                          <dl className="result-meta">
                            {c.type && (
                              <>
                                <dt>Type</dt>
                                <dd>{c.type}</dd>
                              </>
                            )}
                            {c.distance != null && (
                              <>
                                <dt>Distance</dt>
                                <dd>{(c.distance / 1609.344).toFixed(1)} miles</dd>
                              </>
                            )}
                            <dt>Coordinates</dt>
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

            <div className="card">
              <div className="card-header">
                <h2>Nearby Towns</h2>
                <span className="badge">{allTowns.length}</span>
              </div>

              <div className="card-body">
                {loadingTowns && visibleTowns.length === 0 ? (
                  <div className="muted">Loading towns…</div>
                ) : visibleTowns.length === 0 ? (
                  <div className="muted">No towns found in this radius.</div>
                ) : (
                  <>
                    {visibleTowns.map((t) => (
                      <Link 
                        key={`town-${t.id}`} 
                        href={`/how-far-is-${createSlug(t.name)}-from-me`}
                        className="result-link"
                      >
                        <div className="result-section">
                          <h3 className="result-title">{t.name}</h3>
                          <dl className="result-meta">
                            {t.type && (
                              <>
                                <dt>Type</dt>
                                <dd>{t.type}</dd>
                              </>
                            )}
                            {t.distance != null && (
                              <>
                                <dt>Distance</dt>
                                <dd>{(t.distance / 1609.344).toFixed(1)} miles</dd>
                              </>
                            )}
                            <dt>Coordinates</dt>
                            <dd>
                              {t.lat.toFixed(5)}, {t.lon.toFixed(5)}
                            </dd>
                          </dl>
                        </div>
                      </Link>
                    ))}
                    {loadingMoreTowns && <div className="muted">Loading more towns…</div>}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="map-wrap">
            <div className="map">
              {mapReady && (
                <CustomMapWrapper center={center} zoom={10} style={{ height: "100%", width: "100%" }} radiusMeters={radiusMeters}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Search area circle */}
                  <Circle
                    center={center}
                    radius={radiusMeters}
                    color="blue"
                    fillColor="blue"
                    fillOpacity={0.1}
                  />
                  
                  {/* Center marker */}
                  <Marker position={center}>
                    <Popup>
                      <strong>Search Center: {query}</strong>
                      <br />
                      <span>Radius: {radius} miles</span>
                    </Popup>
                  </Marker>
                  
                  {/* City and town markers */}
                  {allMarkers.map((m) => (
                    <Marker 
                      key={`${m.kind}-${m.id}`} 
                      position={[m.lat, m.lon]}
                    >
                      <Popup>
                        <strong>{m.name}</strong>
                        <br />
                        <span>Type: {m.type}</span>
                        <br />
                        <span>{(m.distance / 1609.344).toFixed(1)} miles away</span>
                        <br />
                        <Link 
                          href={`/how-far-is-${createSlug(m.name)}-from-me`}
                          className="popup-link"
                        >
                          View details
                        </Link>
                      </Popup>
                    </Marker>
                  ))}
                </CustomMapWrapper>
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
      <main id="main-content">
        <section className="hero-banner" aria-labelledby="main-heading" aria-describedby="hero-desc">
          <div className="content-container">
            <h1 id="main-heading" className="main-heading">Discover Nearby Cities & Towns</h1>
            <p id="hero-desc" className="hero-subtitle">Enter a location and search radius to explore cities and towns near you.</p>
          </div>
        </section>
      
        <div className="container">
          <Suspense fallback={<div className="info">Loading search parameters...</div>}>
            <ResultsContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}