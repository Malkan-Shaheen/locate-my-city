
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import Footer from '../../components/Footer'
import Header from '../../components/Header';

// Dynamically import Leaflet with loading state
const MapWithNoSSR = dynamic(() => import('../../components/MapComponent'), { 
  ssr: false,
  loading: () => <div className="loading-container"><div className="spinner"></div></div>
});

export default function SpringLocationsExplorer() {
  const [allSprings, setAllSprings] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memoized data processing
  const { commonNamesData, statesMostData, uniqueStatesData, locationsByStateData, stateLocationsData } = useMemo(() => {
    const nameCounts = {};
    const stateCounts = {};
    
    allSprings.forEach(loc => {
      nameCounts[loc.name] = (nameCounts[loc.name] || 0) + 1;
      stateCounts[loc.state] = (stateCounts[loc.state] || 0) + 1;
    });

    const commonNamesData = Object.entries(nameCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const statesMostData = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const uniqueStatesData = [...new Set(allSprings.map(l => l.state))].sort();
    
    const locationsByStateData = allSprings.reduce((acc, loc) => {
      if (!acc[loc.state]) acc[loc.state] = [];
      acc[loc.state].push(loc);
      return acc;
    }, {});

    const stateLocationsData = selectedState ? allSprings.filter(l => l.state === selectedState) : [];

    return {
      commonNamesData,
      statesMostData,
      uniqueStatesData,
      locationsByStateData,
      stateLocationsData
    };
  }, [allSprings, selectedState]);

  // Stable callback for location focus
  const focusOnLocation = useCallback((lat, lon, name) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const cleanUrl = `/location-from-me/how-far-is-${cleanName}-from-me`;
    
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = cleanUrl;
    form.target = '_blank';
    form.style.display = 'none';

    const addHiddenField = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addHiddenField('lat', lat);
    addHiddenField('lon', lon);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }, []);

  // Data fetching with cleanup
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        const backendUrl = 'https://backend-locate1.onrender.com/';

        const response = await fetch(`${backendUrl}/api/springs/flat`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          setAllSprings(data);
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Error loading spring data:', error);
          // Fallback data if API fails
          setAllSprings([
            {
              name: "Blue Springs",
              state: "Alabama",
              lat: 31.66128,
              lon: -85.50744,
              county: null
            }
          ]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Notable locations memoized
  const notableLocations = useMemo(() => [
    { name: "Hot Springs, AR", description: "Historic Spa Town" },
    { name: "Sulphur Springs, TX", description: "Famous for minerals" },
    { name: "Palm Springs, CA", description: "Desert resort" },
    { name: "Coral Springs, FL", description: "Master-planned city" }
  ], []);

  return (
    <>
      <Head>
        <title>LocateMyCity</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
        <title>Spring Locations Explorer</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <meta name="robots" content="index, follow"/>
      </Head>

      <Header />

      <main>
        <section className="page-hero">
          <div className="container">
            <h1>Cities with "Spring" in the Name</h1>
            <p className="subtitle">Discover unique U.S. locations with "Spring" in their name</p>
          </div>
        </section>

      <section className="stats-section">
        <div className="container">
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-card-content">
                <h3 className="stat-card-title">Most Common Names</h3>
                <ul className="stat-card-list">
                  {isLoading ? (
                    <div className="loading-container"><div className="spinner"></div></div>
                  ) : (
                    commonNamesData.map(([name, count]) => (
                      <li key={name} className="stat-card-item">
                        <span>{name}</span> <strong>{count} locations</strong>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <h3 className="stat-card-title">States with Most</h3>
                <ul className="stat-card-list">
                  {isLoading ? (
                    <div className="loading-container"><div className="spinner"></div></div>
                  ) : (
                    statesMostData.map(([state, count]) => (
                      <li key={state} className="stat-card-item">
                        <span>{state}</span> <strong>{count} cities</strong>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-content">
                <h3 className="stat-card-title">Notable Locations</h3>
                <ul className="stat-card-list">
                  {isLoading ? (
                    <div className="loading-container"><div className="spinner"></div></div>
                  ) : (
                    notableLocations.map(location => (
                      <li key={location.name} className="stat-card-item">
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

      <section className="map-section">
        <div className="container">
          <h2 className="section-title">Interactive Map</h2>
          <MapWithNoSSR locations={allSprings} />
        </div>
      </section>

      <section className="states-section">
        <div className="container">
          <h2 className="section-title">Browse by State</h2>
          <div className="states-container">
            {isLoading ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : (
              uniqueStatesData.map(state => (
                <button 
                  key={state} 
                  className="state-btn" 
                  onClick={() => setSelectedState(state)}
                >
                  <span>{state}</span>
                </button>
              ))
            )}
          </div>
          {selectedState && (
            <div id="state-countries-container" style={{ marginTop: '2rem' }}>
              <div className="state-group">
                <h3 className="state-group-title">{selectedState}</h3>
                <div className="countries-list">
                  {stateLocationsData.map(loc => (
                    <div key={`${loc.name}-${loc.lat}-${loc.lon}`} className="country-item">
                      <span className="country-name">{loc.name}</span>
                      <button 
                        className="view-map-btn" 
                        onClick={() => focusOnLocation(loc.lat, loc.lon, loc.name)}
                        style={{ width: '120px' }}
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

      <section className="countries-section">
        <div className="container">
          <h2 className="section-title">All Locations by State</h2>
          {isLoading ? (
            <div className="loading-container"><div className="spinner"></div></div>
          ) : (
            Object.keys(locationsByStateData).sort().map(state => (
              <div key={state} className="state-group">
                <h3 className="state-group-title">{state}</h3>
                <div className="countries-list">
                  {locationsByStateData[state].map(loc => (
                    <div key={`${loc.name}-${loc.lat}-${loc.lon}-all`} className="country-item">
                      <span className="country-name">{loc.name}</span>
                      <button 
                        className="view-map-btn" 
                        onClick={() => focusOnLocation(loc.lat, loc.lon, loc.name)}
                        style={{ width: '120px' }}
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
      
      <Footer />
    </>
  );
}
