'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import React from 'react';

const MapWithNoSSR = dynamic(() => import('../../components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="loading-indicator" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true"></div>
      <span>Loading map...</span>
    </div>
  )
});

export default function RockyLocationsExplorer() {
  const [allRockyLocations, setAllRockyLocations] = useState([]);
  const [selectedUSState, setSelectedUSState] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const stateHeadingRef = useRef(null);

  useEffect(() => {
    if (selectedUSState && stateHeadingRef.current) {
      stateHeadingRef.current.focus();
    }
  }, [selectedUSState]);

useEffect(() => {
  let isMounted = true;

  const loadLocationData = async () => {
    const backendUrl = 'https://backend-locate1.onrender.com';
    console.log("🔄 Starting to load location data from:", backendUrl);

    try {
      setIsDataLoading(true);

      console.log("📡 Sending request to:", `${backendUrl}/api/locations`);
      const response = await fetch(`${backendUrl}/api/locations`, { cache: 'force-cache' });

      console.log("✅ Response received:", response);

      if (!response.ok) {
        console.error(`❌ HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("📦 Parsing JSON data...");
      const locationData = await response.json();

      if (isMounted) {
        console.log("📍 Setting location data with", locationData.length, "items");
        setAllRockyLocations(locationData);
      }
    } catch (error) {
      console.error("🔥 Error loading location data:", error.message);
      console.error("📜 Full error object:", error);
    } finally {
      if (isMounted) {
        console.log("⏹️ Data loading finished");
        setIsDataLoading(false);
      }
    }
  };

  loadLocationData();

  return () => {
    console.log("🧹 Cleaning up: component unmounted");
    isMounted = false;
  };

    loadLocationData();
    return () => { isMounted = false; };
  }, []);

  const commonLocationNames = useMemo(() => {
    const nameFrequency = {};
    allRockyLocations.forEach(location => {
      nameFrequency[location.name] = (nameFrequency[location.name] || 0) + 1;
    });
    return Object.entries(nameFrequency).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [allRockyLocations]);

  const statesWithMostLocations = useMemo(() => {
    const stateFrequency = {};
    allRockyLocations.forEach(location => {
      stateFrequency[location.state] = (stateFrequency[location.state] || 0) + 1;
    });
    return Object.entries(stateFrequency).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [allRockyLocations]);

  const uniqueUSStates = useMemo(() => [...new Set(allRockyLocations.map(l => l.state))].sort(), [allRockyLocations]);

  const locationsForSelectedState = useMemo(() =>
    selectedUSState ? allRockyLocations.filter(l => l.state === selectedUSState) : [],
    [allRockyLocations, selectedUSState]
  );

  const locationsGroupedByState = useMemo(() => {
    return allRockyLocations.reduce((acc, location) => {
      if (!acc[location.state]) acc[location.state] = [];
      acc[location.state].push(location);
      return acc;
    }, {});
  }, [allRockyLocations]);

  const focusOnMapLocation = (lat, lon, name) => {
    const mainName = name.split(',')[0].trim();
    const cleanName = mainName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    window.open(`/location-from-me/how-far-is-${cleanName}-from-me`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Head>
        <title>LocateMyCity - Rocky Locations Explorer</title>
        <meta name="description" content="Discover unique U.S. cities with 'Rock' in their names" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="robots" content="index, follow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" media="all" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
      </Head>

      <Header role="banner" />

      <main id="main-content">
        <section className="hero-banner" aria-labelledby="main-heading" aria-describedby="hero-desc">
          <div className="content-container">
            <h1 id="main-heading" className="main-heading">Cities with "Rock" in the Name</h1>
            <p id="hero-desc" className="hero-subtitle">Discover unique U.S. cities celebrating America's geological heritage</p>
          </div>
        </section>

        <section className="location-statistics" aria-labelledby="statistics-heading">
          <div className="content-container">
            <h2 id="statistics-heading" className="visually-hidden">Location Statistics</h2>
            <div className="stats-grid">
              {/* Common Names */}
              <div className="stat-card" role="region" aria-labelledby="common-names-heading">
                <div className="stat-content">
                  <h3 id="common-names-heading" className="stat-title">Most Common Names</h3>
                  <ul className="stat-list">
                    {isDataLoading ? (
                      <div className="loading-indicator" role="status" aria-live="polite">
                        <div className="loading-spinner" aria-hidden="true"></div>
                        <span>Loading data...</span>
                      </div>
                    ) : (
                      commonLocationNames.map(([name, count]) => (
                        <li key={name} className="stat-item">
                          <span>{name}</span> <strong>{count} locations</strong>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              {/* States with Most */}
              <div className="stat-card" role="region" aria-labelledby="states-most-heading">
                <div className="stat-content">
                  <h3 id="states-most-heading" className="stat-title">States with Most</h3>
                  <ul className="stat-list">
                    {isDataLoading ? (
                      <div className="loading-indicator" role="status" aria-live="polite">
                        <div className="loading-spinner" aria-hidden="true"></div>
                        <span>Loading data...</span>
                      </div>
                    ) : (
                      statesWithMostLocations.map(([state, count]) => (
                        <li key={state} className="stat-item">
                          <span>{state}</span> <strong>{count} cities</strong>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              {/* Notable Locations */}
              <div className="stat-card" role="region" aria-labelledby="notable-locations-heading">
                <div className="stat-content">
                  <h3 id="notable-locations-heading" className="stat-title">Notable Locations</h3>
                  <ul className="stat-list">
                    {isDataLoading ? (
                      <div className="loading-indicator" role="status" aria-live="polite">
                        <div className="loading-spinner" aria-hidden="true"></div>
                        <span>Loading data...</span>
                      </div>
                    ) : (
                      [
                        { name: "Little Rock, AR", description: "State Capital" },
                        { name: "Rockville, MD", description: "DC Suburb" },
                        { name: "Rock Springs, WY", description: "Historic" },
                        { name: "Rock Hill, SC", description: "Major City" }
                      ].map(location => (
                        <li key={location.name} className="stat-item">
                          <span>{location.name}</span> <strong>{location.description}</strong>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="interactive-map-section" aria-labelledby="map-heading">
          <div className="content-container">
            <h2 id="map-heading" className="section-heading">Interactive Map</h2>
            {isDataLoading ? (
              <div className="loading-indicator" role="status" aria-live="polite">
                <div className="loading-spinner" aria-hidden="true"></div>
                <span>Loading map...</span>
              </div>
            ) : (
              <MapWithNoSSR locations={allRockyLocations} />
            )}
          </div>
        </section>

        <section className="state-browser-section" aria-labelledby="state-browser-heading">
          <div className="content-container">
            <h2 id="state-browser-heading" className="section-heading">Browse by State</h2>
            <div className="state-buttons-container" role="group" aria-label="US States">
              {isDataLoading ? (
                <div className="loading-indicator" role="status" aria-live="polite">
                  <div className="loading-spinner" aria-hidden="true"></div>
                  <span>Loading states...</span>
                </div>
              ) : (
                uniqueUSStates.map(state => (
                  <button
                    key={state}
                    className="state-button"
                    onClick={() => setSelectedUSState(state)}
                    aria-label={`Show locations in ${state}`}
                    aria-pressed={selectedUSState === state}
                  >
                    <span>{state}</span>
                  </button>
                ))
              )}
            </div>

            {selectedUSState && (
              <div
                className="state-locations-container"
                style={{ marginTop: '2rem' }}
                role="region"
                aria-labelledby={`${selectedUSState}-locations-heading`}
              >
                <div className="state-location-group">
                  <h3
                    id={`${selectedUSState}-locations-heading`}
                    className="state-group-heading"
                    tabIndex="-1"
                    ref={stateHeadingRef}
                  >
                    {selectedUSState}
                  </h3>
                  <div className="location-list">
                    {locationsForSelectedState.map(location => (
                      <div key={`${location.name}-${location.county}-${location.lat}-${location.lon}`} className="location-item">
                        <span className="location-name">{location.name}</span>
                        <button
                          className="map-view-button"
                          onClick={() => focusOnMapLocation(location.lat, location.lon, location.name)}
                          aria-label={`View ${location.name} on map`}
                        >
                          View on Map
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="all-locations-section" aria-labelledby="all-locations-heading">
          <div className="content-container">
            <h2 id="all-locations-heading" className="section-heading">All Locations by State</h2>
            {isDataLoading ? (
              <div className="loading-indicator" role="status" aria-live="polite">
                <div className="loading-spinner" aria-hidden="true"></div>
                <span>Loading all locations...</span>
              </div>
            ) : (
              Object.keys(locationsGroupedByState).sort().map(state => (
                <div key={state} className="state-location-group" role="region" aria-labelledby={`${state}-all-locations-heading`}>
                  <h3 id={`${state}-all-locations-heading`} className="state-group-heading">{state}</h3>
                  <div className="location-list">
                    {locationsGroupedByState[state].map(location => (
                      <div key={`${location.name}-${location.county}-${location.lat}-${location.lon}`} className="location-item">
                        <span className="location-name">{location.name}</span>
                        <button
                          className="map-view-button"
                          onClick={() => focusOnMapLocation(location.lat, location.lon, location.name)}
                          aria-label={`View ${location.name} on map`}
                        >
                          View on Map
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <Footer role="contentinfo" />
    </>
  );
}
