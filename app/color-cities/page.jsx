'use client';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

// Dynamically import Leaflet to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('../../components/MapComponent'), { ssr: false });

export default function ColorLocationsExplorer() {
  const [colorLocations, setColorLocations] = useState([]);
  const [selectedUSState, setSelectedUSState] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Load color-based location data
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        setIsDataLoading(true);
        
        const backendUrl = 'https://backend-locate1.onrender.com/api/colors/flat';
        console.log("Fetching from:", backendUrl);

        const response = await fetch(backendUrl);
        console.log("Response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const locationData = await response.json();
        console.log("Fetched data:", locationData);

        // Flattened already from endpoint OR if using grouped JSON:
        // const flattened = Object.values(locationData).flat();
        setColorLocations(locationData);

      } catch (error) {
        console.error('Error loading location data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadLocationData();
  }, []);

  // Calculate most common names
  const getCommonLocationNames = () => {
    const nameFrequency = {};
    colorLocations.forEach(location => {
      nameFrequency[location.name] = (nameFrequency[location.name] || 0) + 1;
    });
    return Object.entries(nameFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  };

  // Calculate states with most locations
  const getStatesWithMostLocations = () => {
    const stateFrequency = {};
    colorLocations.forEach(location => {
      stateFrequency[location.state] = (stateFrequency[location.state] || 0) + 1;
    });
    return Object.entries(stateFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  };

  // Get unique states
  const uniqueUSStates = [...new Set(colorLocations.map(l => l.state))].sort();

  // Get locations for selected state
  const locationsForSelectedState = selectedUSState 
    ? colorLocations.filter(l => l.state === selectedUSState)
    : [];

  // Group locations by state for full list
  const locationsGroupedByState = colorLocations.reduce((acc, location) => {
    if (!acc[location.state]) {
      acc[location.state] = [];
    }
    acc[location.state].push(location);
    return acc;
  }, {});

  // Focus map on specific location
  const focusOnMapLocation = (lat, lon, name) => {
    const mainName = name.split(',')[0].trim();
    const cleanName = mainName
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase();
    window.open(`/location-from-me/how-far-is-${cleanName}-from-me`, '_blank');
  };

  return (
    <>
      <Head>
        <title>LocateMyCity</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
     <meta name="robots" content="index, follow">
</meta>
     
      </Head>

      <header className="site-header">
        <div className="header-wrapper">
          <div className="decorative-circle" style={{ width: '80px', height: '80px', top: '20%', left: '10%' }}></div>
          <div className="decorative-circle" style={{ width: '120px', height: '120px', bottom: '-30%', right: '15%' }}></div>
          <div className="decorative-circle" style={{ width: '60px', height: '60px', top: '50%', left: '80%' }}></div>

          <div className="header-content-wrapper">
            <div className="site-logo">
              <Image 
                src="/Images/cityfav.png" 
                alt="LocateMyCity Logo" 
                width={50} 
                height={50} 
                className="logo-img"
                priority
              />
              LocateMyCity
            </div>
            <nav className="main-navigation">
              <a href="/" title="Home">HOME</a>
              <Link href="/about">ABOUT US</Link>
              <Link href="/contact">CONTACT US</Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="hero-banner">
        <div className="content-container">
          <h1 className="main-heading">Cities with "Colors" in the Name</h1>
          <p className="hero-subtitle">Discover unique U.S. locations with "Colors" in their name</p>
        </div>
      </section>

      <main className="main-content">
        <section className="location-statistics">
          <div className="content-container">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-content">
                  <h3 className="stat-title">Most Common Names</h3>
                  <ul className="stat-list">
                    {isDataLoading ? (
                      <div className="loading-indicator"><div className="loading-spinner"></div></div>
                    ) : (
                      getCommonLocationNames().map(([name, count]) => (
                        <li key={name} className="stat-item">
                          <span>{name}</span> <strong>{count} locations</strong>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-content">
                  <h3 className="stat-title">States with Most</h3>
                  <ul className="stat-list">
                    {isDataLoading ? (
                      <div className="loading-indicator"><div className="loading-spinner"></div></div>
                    ) : (
                      getStatesWithMostLocations().map(([state, count]) => (
                        <li key={state} className="stat-item">
                          <span>{state}</span> <strong>{count} cities</strong>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-content">
                  <h3 className="stat-title">Notable Color Cities</h3>
                  <ul className="stat-list">
                    <li><span>Redlands, CA</span> <strong>Historic citrus hub</strong></li>
                    <li><span>White Plains, NY</span> <strong>Suburban metro</strong></li>
                    <li><span>Green Bay, WI</span> <strong>Football capital</strong></li>
                    <li><span>Blue Springs, MO</span> <strong>Quiet charm</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="interactive-map-section">
          <div className="content-container">
            <h2 className="section-heading">Interactive Map</h2>
            {isDataLoading ? (
              <div className="loading-indicator"><div className="loading-spinner"></div></div>
            ) : (
              <MapWithNoSSR locations={colorLocations} />
            )}
          </div>
        </section>

        <section className="state-browser-section">
          <div className="content-container">
            <h2 className="section-heading">Browse by State</h2>
            <div className="state-buttons-container">
              {isDataLoading ? (
                <div className="loading-indicator"><div className="loading-spinner"></div></div>
              ) : (
                uniqueUSStates.map(state => (
                  <button 
                    key={state}
                    className="state-button"
                    onClick={() => setSelectedUSState(state)}
                  >
                    <span>{state}</span>
                  </button>
                ))
              )}
            </div>
            {selectedUSState && (
              <div className="state-locations-container" style={{ marginTop: '2rem' }}>
                <div className="state-location-group">
                  <h3 className="state-group-heading">{selectedUSState}</h3>
                  <div className="location-list">
                    {locationsForSelectedState.map(location => (
                      <div key={`${location.name}-${location.lat}-${location.lon}`} className="location-item">
                        <span className="location-name">{location.name}</span>
                        <button 
                          className="map-view-button" 
                          onClick={() => focusOnMapLocation(location.lat, location.lon, location.name)}
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

        <section className="all-locations-section">
          <div className="content-container">
            <h2 className="section-heading">All Locations by State</h2>
            {isDataLoading ? (
              <div className="loading-indicator"><div className="loading-spinner"></div></div>
            ) : (
              Object.keys(locationsGroupedByState).sort().map(state => (
                <div key={state} className="state-location-group">
                  <h3 className="state-group-heading">{state}</h3>
                  <div className="location-list">
                    {locationsGroupedByState[state].map(location => (
                      <div key={`${location.name}-${location.lat}-${location.lon}`} className="location-item">
                        <span className="location-name">{location.name}</span>
                        <button 
                          className="map-view-button"
                          onClick={() => focusOnMapLocation(location.lat, location.lon, location.name)}
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

