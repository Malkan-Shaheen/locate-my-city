'use client';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function HeroSection() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const containerRef = useRef(null);
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsFetching(true);
    try {
      const response = await fetch(
        `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LocateMyCity/1.0 (your@email.com)'
          }
        }
      );
      
      if (response.status === 429) {
        console.warn('API rate limit exceeded');
        return;
      }

      const data = await response.json();
      
      // Enhanced suggestion formatting
      const formattedSuggestions = data.map(item => {
        // For countries, use the country name
        if (item.type === 'administrative' && item.address?.country) {
          return {
            ...item,
            display_name: item.address.country,
            full_display: item.display_name
          };
        }

        // For other types, extract the most relevant name
        const mainName = item.address?.city || item.address?.town || 
                        item.address?.village || item.address?.hamlet ||
                        item.address?.municipality || item.address?.state ||
                        item.display_name.split(',')[0];

        return {
          ...item,
          display_name: mainName,
          full_display: item.display_name
        };
      }).filter(item => item.display_name); // Filter out empty names

      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsFetching(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setDestination(value);
    fetchSuggestions(value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion) => {
    setDestination(suggestion.display_name);
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!destination.trim()) return;

    // Create URL-friendly destination string
    const destinationSlug = destination
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

      router.push(`/location-from-me/how-far-is-${destinationSlug}-from-me`);
  };

  return (
    <>
     <Head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LocateMyCity</title>
  <meta name="description" content="LocateMyCity helps you instantly explore locations worldwide – from ghost towns to booming cities. Find distances, compare places, and discover natural features in seconds." />
  <meta name="robots" content="index, follow" />
  
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
</Head>


      <div className="hero-container" ref={containerRef}>
        <section className="hero" id="main-content">
          <div className="floating-elements">
            <div className="floating-element" style={{ width: '40px', height: '40px', top: '20%', left: '10%', animationDelay: '0s' }}></div>
            <div className="floating-element" style={{ width: '60px', height: '60px', top: '60%', left: '80%', animationDelay: '2s' }}></div>
            <div className="floating-element" style={{ width: '30px', height: '30px', top: '30%', left: '70%', animationDelay: '4s' }}></div>
            <div className="floating-element" style={{ width: '50px', height: '50px', top: '70%', left: '20%', animationDelay: '6s' }}></div>
          </div>

          <div className="hero-content">
            <div className="feature-section">
              <h1>Explore Locations Around the World. Instantly.</h1>
              <p className="feature-text">
                From abandoned ghost towns and remote tropical islands to booming cities on every continent, 
                LocateMyCity helps you uncover key facts about any place — how far it is, whether it's a city 
                or town, or if it's no longer inhabited. Search by name or explore by keyword. Fast. Precise. Reliable.
              </p>
            </div>
          </div>

          <div className="hero-form-container">
            <div className="hero-form">
              <h2>Find Locations</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label htmlFor="heroDestination">Enter a Destination</label>
                  <input 
                    type="text" 
                    id="heroDestination" 
                    value={destination}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Enter address, city, or landmark" 
                    required 
                    aria-describedby={showSuggestions ? "suggestions-list" : undefined}
                    aria-expanded={showSuggestions}
                    aria-autocomplete="list"
                    role="combobox"
                  />
                  {showSuggestions && (isFetching ? (
                    <div className="suggestions-dropdown" role="status" aria-live="polite">
                      <div className="loading-suggestion">Loading suggestions...</div>
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ul className="suggestions-dropdown" id="suggestions-list" role="listbox">
                      {suggestions.map((suggestion, index) => (
                        <li 
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          onMouseDown={(e) => e.preventDefault()}
                          role="option"
                          tabIndex={-1}
                        >
                          <div className="suggestion-main">{suggestion.display_name}</div>
                          <div className="suggestion-detail">
                            {suggestion.full_display.split(',').slice(1, 3).join(',')}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : destination.length > 1 && (
                    <div className="suggestions-dropdown">
                      <div className="no-suggestions">
                        {response?.status === 429 
                          ? 'Search limit reached. Please try again later.' 
                          : 'No locations found. Try a different search term.'}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="location-from-me-text">or find locations near me</p>
                <button type="submit" className="find-me-btn">
                  <span aria-label="location">📍</span> Find Location From Me
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          border: 1px solid #ddd;
          border-radius: 0 0 8px 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          z-index: 100;
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .suggestions-dropdown li {
          padding: 10px 15px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .suggestions-dropdown li:hover {
          background-color: #f5f5f5;
        }

        .suggestion-main {
          font-weight: 500;
          margin-bottom: 2px;
        }

        .suggestion-detail {
          font-size: 0.8rem;
          color: #666;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .loading-suggestion,
        .no-suggestions {
          padding: 10px 15px;
          color: #666;
          font-size: 0.9rem;
        }
      `}</style>
    </>
  );
}
