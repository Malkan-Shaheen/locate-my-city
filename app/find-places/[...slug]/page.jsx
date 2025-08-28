"use client";
import { Suspense, useEffect, useMemo, useState, useRef, createContext, useContext } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import "leaflet/dist/leaflet.css";
import Head from 'next/head';

// Create a context to share random locations
const RandomLocationsContext = createContext([]);

// Helper function to get random items from an array
function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

const faqs = [
  {
    id: 'faq1',
    question: 'What information can I find on LocateMyCity?',
    answer: 'LocateMyCity provides detailed insights about locations, including city/town status, distance measurements, and unique geographical traits.',
  },
  {
    id: 'faq2',
    question: 'How do I use the distance calculator?',
    answer: 'Either allow location access or manually enter locations to calculate real-time distances in miles or kilometers.',
  },
  {
    id: 'faq3',
    question: 'Can I compare multiple locations?',
    answer: 'Yes, our Location to Location tool lets you compare multiple destinations for effective trip planning.',
  },
  {
    id: 'faq4',
    question: 'How current is the location data?',
    answer: 'We update weekly using verified sources including satellite imagery and government data.',
  },
  {
    id: 'faq5',
    question: 'What makes LocateMyCity different?',
    answer: 'We highlight unique natural features and cover both abandoned and active locations with faster search and data accuracy than traditional tools.',
  },
];

// Dynamically import react-leaflet components
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

// ✅ import useMap directly (not dynamically)
import { useMap } from "react-leaflet";

const milesToMeters = (mi) => Number(mi) * 1609.344;

// Cache implementation
const queryCache = new Map();
function getCacheKey(lat, lon, radius, queryType) {
  return `${lat.toFixed(4)}_${lon.toFixed(4)}_${radius}_${queryType}`;
}

// Overpass API helper functions
function buildCitiesQuery(lat, lon, radius, countryCode = null) {
  let areaFilter = "";
  if (countryCode) {
    areaFilter = `area["ISO3166-1"="${countryCode}"][admin_level=2];`;
  }
  return `
    [out:json][timeout:25];
    ${areaFilter}
    (
      node(around:${radius},${lat},${lon})["place"~"city"]${areaFilter ? '(area)' : ''};
      way(around:${radius},${lat},${lon})["place"~"city"]${areaFilter ? '(area)' : ''};
      relation(around:${radius},${lat},${lon})["place"~"city"]${areaFilter ? '(area)' : ''};
    );
    out center;
  `;
}

function buildTownsQuery(lat, lon, radius, countryCode = null) {
  let areaFilter = "";
  if (countryCode) {
    areaFilter = `area["ISO3166-1"="${countryCode}"][admin_level=2];`;
  }
  return `
    [out:json][timeout:25];
    ${areaFilter}
    (
      node(around:${radius},${lat},${lon})["place"~"town"]${areaFilter ? '(area)' : ''};
      way(around:${radius},${lat},${lon})["place"~"town"]${areaFilter ? '(area)' : ''};
      relation(around:${radius},${lat},${lon})["place"~"town"]${areaFilter ? '(area)' : ''};
    );
    out center;
  `;
}

function buildCombinedQuery(lat, lon, radius, countryCode = null) {
  let areaFilter = "";
  if (countryCode) {
    areaFilter = `area["ISO3166-1"="${countryCode}"][admin_level=2];`;
  }
  return `
    [out:json][timeout:25];
    ${areaFilter}
    (
      node(around:${radius},${lat},${lon})["place"~"city|town"]${areaFilter ? '(area)' : ''};
      way(around:${radius},${lat},${lon})["place"~"city|town"]${areaFilter ? '(area)' : ''};
      relation(around:${radius},${lat},${lon})["place"~"city|town"]${areaFilter ? '(area)' : ''};
    );
    out center;
  `;
}

async function callOverpassQuery(q, useCache = true) {
  console.log("Calling Overpass API with query:", q);
  
  // Check cache first if enabled
  if (useCache && queryCache.has(q)) {
    console.log("Cache hit for query");
    return queryCache.get(q);
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];

  for (const ep of endpoints) {
    try {
      console.log("Trying endpoint:", ep);
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
      });

      if (r.ok) {
        console.log("Successfully fetched from endpoint:", ep);
        const data = await r.json();
        
        // Cache the result (with 5 minute expiry)
        if (useCache) {
          queryCache.set(q, data);
          setTimeout(() => queryCache.delete(q), 5 * 60 * 1000);
        }
        
        return data;
      }
    } catch (e) {
      console.error("Error with endpoint", ep, e);
      continue;
    }
  }
  
  throw new Error("All Overpass endpoints failed");
}

// ✅ MapInteractionTracker component
function MapInteractionTracker({ onInteraction }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    const handleMove = () => {
      onInteraction(true);
    };
    
    const handleZoom = () => {
      onInteraction(true);
    };
    
    map.on('move', handleMove);
    map.on('zoom', handleZoom);
    
    return () => {
      map.off('move', handleMove);
      map.off('zoom', handleZoom);
    };
  }, [map, onInteraction]);
  
  return null;
}

// ✅ Updated MapBoundsFitter
function MapBoundsFitter({ center, radiusMeters, markers, shouldFit }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !center || !radiusMeters || !shouldFit) return;
    
    const L = window.L;
    if (!L) return;
    
    try {
      const circle = L.circle(L.latLng(center[0], center[1]), { radius: radiusMeters });
      let bounds = circle.getBounds();
      
      if (markers?.length > 0) {
        const markerBounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon]));
        bounds = bounds.extend(markerBounds);
      }
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
      } else {
        map.setView(L.latLng(center[0], center[1]), 10);
      }
    } catch (e) {
      console.error("Error fitting map bounds:", e);
      map.setView(L.latLng(center[0], center[1]), 10);
    }
  }, [map, center, radiusMeters, markers, shouldFit]);
  
  return null;
}

// ✅ New: AutoPan immediately after geocode fetch
function AutoPanToCenter({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (map && center) {
      map.setView(center, 10, { animate: true });
    }
  }, [map, center]);
  
  return null;
}

// ✅ global dedupe set
const seenPlaceNames = new Set();

async function callOverpassWithChunking(lat, lon, radius, qBuilder, onDataChunk = null, query = "") {
  console.log("callOverpassWithChunking called with:", {lat, lon, radius});
  
  if (radius <= 300000) {
    const q = qBuilder(lat, lon, radius);
    const result = await callOverpassQuery(q);
    
    if (onDataChunk && result?.elements) {
      const processed = processChunk(result.elements, lat, lon, radius, query);
      if (processed.length > 0) {
        onDataChunk(processed);
      }
    }
    
    return result;
  }
  
  const step = 100000;
  let start = 0;
  const all = [];
  
  while (start < radius) {
    const end = Math.min(start + step, radius);
    const q = qBuilder(lat, lon, end);
    
    try {
      const json = await callOverpassQuery(q);
      
      if (json?.elements) {
        all.push(...json.elements);
        
        if (onDataChunk) {
          const processed = processChunk(json.elements, lat, lon, end, query);
          if (processed.length > 0) {
            onDataChunk(processed);
          }
        }
      }
    } catch (e) {
      console.error("Chunk failed:", e);
    }
    
    start = end;
  }
  
  return { elements: all };
}

// ✅ fixed processChunk function
function processChunk(elements, centerLat, centerLon, radius, query = "") {
  const items = [];
  
  for (const e of elements) {
    const tags = e.tags || {};
    const latNum = e.lat ?? e.center?.lat;
    const lonNum = e.lon ?? e.center?.lon;
    
    if (latNum == null || lonNum == null) continue;
    
    const name = tags.name || "Unnamed settlement";
    const nameEn = tags["name:en"] || null;
    const displayName = nameEn && nameEn !== name ? `${name} (${nameEn})` : name;
    const placeType = tags.place || "settlement";
    
    // ❌ Skip if name matches query
    if (query && name.toLowerCase().includes(query.toLowerCase())) continue;
    
    // ❌ Skip duplicates globally
    if (seenPlaceNames.has(displayName.toLowerCase())) continue;
    seenPlaceNames.add(displayName.toLowerCase());
    
    const cLat = Number(centerLat), cLon = Number(centerLon);
    const dx = (Number(lonNum) - cLon) * 111320 * Math.cos((cLat * Math.PI) / 180);
    const dy = (Number(latNum) - cLat) * 110540;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 1000 || distance > radius) continue;
    
    items.push({
      id: `${displayName.toLowerCase()}_${latNum.toFixed(4)}_${lonNum.toFixed(4)}`,
      name: displayName,
      originalName: name,
      type: placeType,
      lat: Number(latNum),
      lon: Number(lonNum),
      distance,
    });
  }
  
  return items;
}

// New function to fetch initial data quickly
// Update the function signatures
async function fetchInitialSettlements(lat, lon, radius, onDataChunk, query, countryCode) {
  console.log("fetchInitialSettlements called with:", {lat, lon, radius, countryCode});
  
  try {
    // Use a smaller radius for initial quick results
    const initialRadius = Math.min(radius, 50000); // 50km max for initial fetch
    const q = buildCombinedQuery(lat, lon, initialRadius, countryCode);
    const json = await callOverpassQuery(q, true); // Use cache for initial fetch
    
    if (json?.elements) {
      const processed = processChunk(json.elements, lat, lon, initialRadius, query);
      
      // Separate cities and towns
      const cities = processed.filter(item => item.type === "city");
      const towns = processed.filter(item => item.type === "town");
      
      if (onDataChunk) {
        onDataChunk({ cities, towns });
      }
    }
    
    return json.elements?.length || 0;
  } catch (e) {
    console.error("Error in fetchInitialSettlements:", e);
    throw new Error("Failed to fetch initial settlements: " + e.message);
  }
}

async function fetchCitiesDirectly(lat, lon, radius, onDataChunk, query, countryCode) {
  console.log("fetchCitiesDirectly called with:", {lat, lon, radius, countryCode});
  
  try {
    const json = await callOverpassWithChunking(
      lat, lon, radius,
      (lat, lon, rad) => buildCitiesQuery(lat, lon, rad, countryCode),
      onDataChunk,
      query
    );
    
    const elements = json.elements || [];
    console.log("Total city elements from API:", elements.length);
    return elements.length;
  } catch (e) {
    console.error("Error in fetchCitiesDirectly:", e);
    throw new Error("Failed to fetch cities: " + e.message);
  }
}

async function fetchTownsDirectly(lat, lon, radius, onDataChunk, query, countryCode) {
  console.log("fetchTownsDirectly called with:", {lat, lon, radius, countryCode});
  
  try {
    const json = await callOverpassWithChunking(
      lat, lon, radius,
      (lat, lon, rad) => buildTownsQuery(lat, lon, rad, countryCode),
      (chunk) => {
        const filteredChunk = chunk.filter(item => item.type !== "city");
        if (filteredChunk.length > 0) {
          onDataChunk(filteredChunk);
        }
      },
      query
    );
    
    const elements = json.elements || [];
    console.log("Total town elements from API:", elements.length);
    return elements.length;
  } catch (e) {
    console.error("Error in fetchTownsDirectly:", e);
    throw new Error("Failed to fetch towns: " + e.message);
  }
}

function ResultsContent() {
  // Safely extract parameters with proper fallbacks
  const params = useParams();
  const slugArray = params?.slug || [];
  console.log("URL params:", {slugArray});
  
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
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const radiusNum = parseInt(radius);
  const NEXT_RADIUS = radiusNum + 10;
  const PREV_RADIUS = Math.max(10, radiusNum - 10);
  
  console.log("Parsed parameters:", {query, radius, radiusMeters});
  
  const [center, setCenter] = useState([31.5204, 74.3587]); // Default to Islamabad
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);
  const [geo, setGeo] = useState(null);
  const [activeFAQ, setActiveFAQ] = useState(null);
  
  // 👇 main states
  const [allCities, setAllCities] = useState([]);
  const [visibleCities, setVisibleCities] = useState([]);
  const [allTowns, setAllTowns] = useState([]);
  const [visibleTowns, setVisibleTowns] = useState([]);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Get setRandomLocations from context
  const setRandomLocations = useContext(RandomLocationsContext).setRandomLocations;
  
  // Configure leaflet icons
  useEffect(() => {
    (async () => {
      console.log("Setting up leaflet icons");
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
      console.log("Leaflet icons setup complete");
    })();
  }, []);
  
  // Fetch geo + cities + towns
  useEffect(() => {
    let isCancelled = false;
    
    async function fetchData() {
      try {
        setError("");
        console.log("Starting data fetch for query:", query);
        
        if (!query) {
          throw new Error("No location provided");
        }
        
        // Fetch geocode
        console.log("Fetching geocode for:", query);
        const geoRes = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
        if (!geoRes.ok) throw new Error("Geocoding failed");
        
        const g = await geoRes.json();
        if (!g?.lat || !g?.lon) throw new Error("Location not found");
        
        // Extract country code from the response
        const countryCode = g.country_code || null;
        console.log("Country code detected:", countryCode);
        
        if (isCancelled) {
          return;
        }
        
        const lat = Number(g.lat);
        const lon = Number(g.lon);
        console.log("Geocode result:", g);
        
        setGeo(g);
        setCenter([lat, lon]);
        
        // Clear previous data
        setVisibleCities([]);
        setVisibleTowns([]);
        setAllCities([]);
        setAllTowns([]);
        
        // First: Fetch initial results quickly with combined query
        console.log("Starting initial combined fetch");
        setLoadingCities(true);
        setLoadingTowns(true);
        
        fetchInitialSettlements(lat, lon, radiusMeters, (data) => {
          if (!isCancelled) {
            console.log("Processing initial settlements:", data.cities.length, "cities,", data.towns.length, "towns");
            
            if (data.cities.length > 0) {
              setVisibleCities(data.cities.sort((a, b) => a.distance - b.distance));
              setAllCities(data.cities);
            }
            
            if (data.towns.length > 0) {
              setVisibleTowns(data.towns.sort((a, b) => a.distance - b.distance));
              setAllTowns(data.towns);
            }
            
            setInitialLoadComplete(true);
            setLoadingCities(false);
            setLoadingTowns(false);
          }
        }, query, countryCode) // Pass countryCode here
        .then(totalCount => {
          if (!isCancelled) {
            console.log("Initial fetch completed:", totalCount, "items processed");
          }
        })
        .catch(err => {
          if (!isCancelled) {
            console.error("Initial fetch error:", err);
            // Continue with individual fetches even if initial fails
          }
        });
        
        // Second: Fetch full results in background
        if (radiusMeters > 50000) {
          console.log("Starting full cities fetch in background");
          setLoadingCities(true);
          
          fetchCitiesDirectly(lat, lon, radiusMeters, (citiesChunk) => {
            if (!isCancelled) {
              console.log("Processing cities chunk:", citiesChunk.length);
              setVisibleCities(prev => {
                const newCities = [...prev, ...citiesChunk];
                // Sort by distance as we add new items
                return newCities.sort((a, b) => a.distance - b.distance);
              });
              setAllCities(prev => [...prev, ...citiesChunk]);
            }
          }, query, countryCode) // Pass countryCode here
          .then(totalCount => {
            if (!isCancelled) {
              console.log("Cities fetch completed:", totalCount, "cities processed");
              setLoadingCities(false);
            }
          })
          .catch(err => {
            if (!isCancelled) {
              console.error("Cities fetch error:", err);
              setError("Failed to load cities: " + err.message);
              setLoadingCities(false);
            }
          });
          
          console.log("Starting full towns fetch in background");
          setLoadingTowns(true);
          
          fetchTownsDirectly(lat, lon, radiusMeters, (townsChunk) => {
            if (!isCancelled) {
              console.log("Processing towns chunk:", townsChunk.length);
              setVisibleTowns(prev => {
                const newTowns = [...prev, ...townsChunk];
                // Sort by distance as we add new items
                return newTowns.sort((a, b) => a.distance - b.distance);
              });
              setAllTowns(prev => [...prev, ...townsChunk]);
            }
          }, query, countryCode) // Pass countryCode here
          .then(totalCount => {
            if (!isCancelled) {
              console.log("Towns fetch completed:", totalCount, "towns processed");
              setLoadingTowns(false);
            }
          })
          .catch(err => {
            if (!isCancelled) {
              console.error("Towns fetch error:", err);
              setError("Failed to load towns: " + err.message);
              setLoadingTowns(false);
            }
          });
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Data fetch error:", err);
          setError(err.message || "Something went wrong");
        }
      }
    }
    
    fetchData();
    
    return () => {
      isCancelled = true;
      console.log("Cleanup: cancelling data fetch");
    };
  }, [query, radiusMeters]);
  
  useEffect(() => {
    if (visibleCities.length > 0 || visibleTowns.length > 0) {
      const allLocations = [...visibleCities, ...visibleTowns];
      const randomLocations = getRandomItems(allLocations, 3);
      setRandomLocations(randomLocations);
    }
  }, [visibleCities, visibleTowns, setRandomLocations]);

  const allMarkers = useMemo(() => {
    const mk = [];
    for (const c of visibleCities) if (c.lat && c.lon) mk.push({ ...c, kind: "city" });
    for (const t of visibleTowns) if (t.lat && t.lon) mk.push({ ...t, kind: "town" });
    console.log("All markers for map:", mk.length);
    return mk;
  }, [visibleCities, visibleTowns]);
  
  const createSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };
  
  console.log("Rendering with state:", {
    loadingCities,
    loadingTowns,
    visibleCities: visibleCities.length,
    visibleTowns: visibleTowns.length,
    allCities: allCities.length,
    allTowns: allTowns.length,
    error,
    initialLoadComplete
  });
  
  return (
    <>
      <h1 className="title">
        Cities and towns within {radius} miles of {query}
      </h1>
      
      {(loadingCities || loadingTowns) && (
        <div className="info">
          {loadingCities && "Loading cities… "}
          {loadingTowns && "Loading towns…"}
          {initialLoadComplete && " (loading more results…)"}
        </div>
      )}
      
      {error && <div className="error">⚠️ {error}</div>}
      
      {!error && (
        <>
          <section className="cards">
            <div className="card">
              <div className="card-header">
                <h2>Nearby Cities</h2>
                <span className="badge">{visibleCities.length}</span>
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
                        target="_blank"
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
                    {loadingCities && initialLoadComplete && <div className="muted">Loading more cities…</div>}
                  </>
                )}
              </div>
            </div>
            
            <div className="card">
              <div className="card-header">
                <h2>Nearby Towns</h2>
                <span className="badge">{visibleTowns.length}</span>
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
                        target="_blank"
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
                    {loadingTowns && initialLoadComplete && <div className="muted">Loading more towns…</div>}
                  </>
                )}
              </div>
            </div>
          </section>
          
          <section className="map-wrap">
            <div className="map">
              {mapReady && center && (
                <MapContainer
                  center={center}
                  zoom={10}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Track user interactions */}
                  <MapInteractionTracker onInteraction={setUserHasInteracted} />
                  
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
                          target="_blank"
                          className="popup-link"
                        >
                          View details
                        </Link>
                      </Popup>
                    </Marker>
                  ))}
                  
                  {/* Auto-pan immediately after geocode - only if user hasn't interacted */}
                  {!userHasInteracted && <AutoPanToCenter center={center} />}
                  
                  {/* Map bounds fitter - only fit if user hasn't interacted */}
                  <MapBoundsFitter
                    center={center}
                    radiusMeters={radiusMeters}
                    markers={allMarkers}
                    shouldFit={!userHasInteracted}
                  />
                </MapContainer>
              )}
            </div>
          </section>
          
         <section className="faq-page container" aria-labelledby="faq-section-title">
  <h2 id="faq-section-title" className="faq-title">Frequently Asked Questions about Places within {radius} Miles of {query}</h2>
  
  <div className="faq-list">
    <div
      className={`faq-card ${activeFAQ === 0 ? 'open' : ''}`}
      role="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveFAQ(prev => prev === 0 ? null : 0);
        requestAnimationFrame(() => window.scrollTo(0, window.scrollY));
      }}
      aria-expanded={activeFAQ === 0}
      aria-controls="faq-answer-1"
    >
      <h3 className="faq-question">What cities are within {radius} miles of {query}?</h3>
      <div
        id="faq-answer-1"
        className="faq-answer"
        role="region"
        aria-labelledby="faq-question-1"
        hidden={activeFAQ !== 0}
        style={{ overflowAnchor: 'none' }}
      >
        <p>
          {visibleCities.length > 0 ? (
            <>Nearby cities include {visibleCities[0]?.name}, {visibleCities[1]?.name} and others within {radius} miles.</>
          ) : (
            <>There are no cities within this radius.</>
          )}
        </p>
      </div>
    </div>
    
    <div
      className={`faq-card ${activeFAQ === 1 ? 'open' : ''}`}
      role="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveFAQ(prev => prev === 1 ? null : 1);
        requestAnimationFrame(() => window.scrollTo(0, window.scrollY));
      }}
      aria-expanded={activeFAQ === 1}
      aria-controls="faq-answer-2"
    >
      <h3 className="faq-question">What towns are within {radius} miles of {query}?</h3>
      <div
        id="faq-answer-2"
        className="faq-answer"
        role="region"
        aria-labelledby="faq-question-2"
        hidden={activeFAQ !== 1}
        style={{ overflowAnchor: 'none' }}
      >
        <p>
          {visibleTowns.length > 0 ? (
            <>You'll find towns like {visibleTowns[0]?.name} and {visibleTowns[1]?.name}, all easily accessible from {query}.</>
          ) : (
            <>No towns were found in this radius.</>
          )}
        </p>
      </div>
    </div>
    
    <div
      className={`faq-card ${activeFAQ === 2 ? 'open' : ''}`}
      role="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveFAQ(prev => prev === 2 ? null : 2);
        requestAnimationFrame(() => window.scrollTo(0, window.scrollY));
      }}
      aria-expanded={activeFAQ === 2}
      aria-controls="faq-answer-3"
    >
      <h3 className="faq-question">How do you calculate the distances?</h3>
      <div
        id="faq-answer-3"
        className="faq-answer"
        role="region"
        aria-labelledby="faq-question-3"
        hidden={activeFAQ !== 2}
        style={{ overflowAnchor: 'none' }}
      >
        <p>We use the great-circle formula ("as the crow flies") from {query} to each place. Driving times may differ depending on roads and traffic.</p>
      </div>
    </div>
    
    <div
      className={`faq-card ${activeFAQ === 3 ? 'open' : ''}`}
      role="button"
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveFAQ(prev => prev === 3 ? null : 3);
        requestAnimationFrame(() => window.scrollTo(0, window.scrollY));
      }}
      aria-expanded={activeFAQ === 3}
      aria-controls="faq-answer-4"
    >
      <h3 className="faq-question">Can I search a different radius?</h3>
      <div
        id="faq-answer-4"
        className="faq-answer"
        role="region"
        aria-labelledby="faq-question-4"
        hidden={activeFAQ !== 3}
        style={{ overflowAnchor: 'none' }}
      >
        <p>
          Yes! You can expand your search to{" "}
          <a href={`/places-${NEXT_RADIUS}-miles-from-${createSlug(query)}`}>
            {NEXT_RADIUS} miles
          </a>{" "}
          or shrink it to{" "}
          <a href={`/places-${PREV_RADIUS}-miles-from-${createSlug(query)}`}>
            {PREV_RADIUS} miles
          </a>.
        </p>
      </div>
    </div>
  </div>
</section>
        </>
      )}
    </>
  );
}

// Function to format the subtitle
function formatSubtitle(randomLocations) {
  if (randomLocations.length === 0) {
    return "Discover nearby cities and towns within your search radius.";
  }
  
  const locationNames = randomLocations.map(loc => loc.name);
  
  if (locationNames.length === 1) {
    return `Including ${locationNames[0]}`;
  } else if (locationNames.length === 2) {
    return `Including ${locationNames[0]} and ${locationNames[1]}`;
  } else {
    return `Including ${locationNames[0]}, ${locationNames[1]}, and ${locationNames[2]}`;
  }
}

export default function ResultsPage() {
  const params = useParams();
  const slugArray = params?.slug || [];
  
  // Extract query and radius from slug
  let radius = "10";
  let query = "";
  
  if (slugArray[0]) {
    const match = slugArray[0].match(/places-(\d+)-miles-from-(.+)/);
    if (match) {
      radius = match[1];
      query = decodeURIComponent(match[2]);
    }
  }
  
  // Create state for random locations
  const [randomLocations, setRandomLocations] = useState([]);
  
  return (
    <RandomLocationsContext.Provider value={{ randomLocations, setRandomLocations }}>
      <div className="page-results">
        <Header />
        <Head>
          <title>Cities and towns within {radius} miles of {query}</title>
          <meta name="description" content={`Find nearby cities and towns within ${radius} miles of ${query} including distance, coordinates, and other details.`} />
          <link rel="preload" href="/globals.css" as="style" />
          <meta name="robots" content="index, follow"></meta>
        </Head>
        
        <main id="main-content">
          <section className="hero-banner" aria-labelledby="main-heading" aria-describedby="hero-desc">
            <div className="content-container">
              <h1 id="main-heading" className="main-heading">Cities and towns within {radius} miles of {query}</h1>
              <p id="hero-desc" className="hero-subtitle">Find nearby cities and towns within {radius} Miles of {query},
                {formatSubtitle(randomLocations)} Get distances, coordinates and an interactive map.
              </p>
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
    </RandomLocationsContext.Provider>
  );
}