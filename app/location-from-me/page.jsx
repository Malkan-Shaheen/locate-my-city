'use client';
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { FaMapMarkerAlt, FaArrowRight } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer'

export default function DistanceCalculator() {
  const [destinationInput, setDestinationInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const destinationInputRef = useRef(null);
  const router = useRouter();

  const fetchSuggestions = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&addressdetails=1`
      );
      const data = await response.json();

      const filtered = data.map(item => {
        let name = item.display_name.split(',')[0];
        if (item.address) {
          name = item.address.city || item.address.town || 
                 item.address.village || item.address.county || 
                 item.address.state || item.address.country || 
                 name;
        }

        return {
          ...item,
          short_name: name.length > 30 ? `${name.substring(0, 30)}...` : name
        };
      });

      setSuggestions(filtered);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setDestinationInput(value);
    fetchSuggestions(value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion) => {
    setDestinationInput(suggestion.short_name);
    setShowSuggestions(false);
  };

  const handleCalculate = () => {
    if (!destinationInput.trim()) {
      alert('Please enter a destination first');
      return;
    }

    // Create URL-friendly destination string
    const destinationSlug = destinationInput
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    router.push(`/location-from-me/how-far-is-${destinationSlug}-from-me`);
  };

  return (
    <>
      <Header />
      <Head>
        <title>Distance Calculator | LocateMyCity</title>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta name="robots" content="index, follow"></meta>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
      </Head>

      <main className="distance-page">
        <div className="floating-elements">
          <div className="floating-element" style={{ width: '100px', height: '100px', top: '20%', left: '10%', animationDelay: '0s' }}></div>
          <div className="floating-element" style={{ width: '150px', height: '150px', top: '60%', left: '70%', animationDelay: '2s' }}></div>
          <div className="floating-element" style={{ width: '80px', height: '80px', top: '30%', left: '80%', animationDelay: '4s' }}></div>
          <div className="floating-element" style={{ width: '120px', height: '120px', top: '70%', left: '15%', animationDelay: '6s' }}></div>
        </div>

        <div className="page-title">
          <h1>Distance Calculator</h1>
          <p>Find the exact distance between your current location and any destination worldwide.</p>
        </div>

        <div className="distance-container">
          <div className="distance-form">
            <div className="form-group">
              <label htmlFor="destination">Destination</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={destinationInputRef}
                  type="text"
                  id="destination"
                  className="form-control"
                  placeholder="Enter address, city, or landmark"
                  value={destinationInput}
                  onChange={handleInputChange}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  aria-describedby={showSuggestions && suggestions.length > 0 ? "destination-suggestions" : undefined}
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-autocomplete="list"
                  role="combobox"
                />
                <button
                  onClick={() => setShowSuggestions(true)}
                  aria-label="Show location suggestions"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#4682B4',
                    fontSize: '1rem',
                    padding: '5px',
                    borderRadius: '50%',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <FaArrowRight />
                </button>
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="suggestions-list" id="destination-suggestions" role="listbox">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="suggestion-item"
                        role="option"
                        tabIndex={-1}
                      >
                        {suggestion.short_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button className="calculate-btn" onClick={handleCalculate}>
              <span id="btnText">Calculate Distance</span>
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
