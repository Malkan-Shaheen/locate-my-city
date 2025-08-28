"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import Head from "next/head";

export default function FindPlacesPage() {
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState("10");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const locationInputRef = useRef(null);
  const router = useRouter();

  // fetch suggestions (same logic from DistanceCalculator)
  const fetchSuggestions = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=10&addressdetails=1`
      );
      const data = await response.json();

      const filtered = data.map((item) => {
        let name = item.display_name.split(",")[0];
        if (item.address) {
          name =
            item.address.city ||
            item.address.town ||
            item.address.village ||
            item.address.county ||
            item.address.state ||
            item.address.country ||
            name;
        }

        return {
          ...item,
          short_name:
            name.length > 30 ? `${name.substring(0, 30)}...` : name,
        };
      });

      setSuggestions(filtered);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setLocation(value);
    fetchSuggestions(value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion) => {
    setLocation(suggestion.short_name);
    setShowSuggestions(false);
  };

  const handleSearch = () => {
    if (!location) {
      alert("Please enter a location.");
      return;
    }

    const slug = `/places-${radius}-miles-from-${encodeURIComponent(
      location
    )}`;
    router.push(slug);
  };

  return (
    
    <div className="page2">
      <Head>
              <title>{`Find places`}</title>
              <meta name="description" content={`NEarby Places`} />
           <link rel="preload" href="/globals.css" as="style" />
           <meta name="robots" content="index, follow">
      </meta>
            </Head>
      <Header />

      <main className="main2">
        <div className="card2">
          <div className="card-border-top2" />

          <div className="card-content2">
            <div className="heading2">
              <h1>Discover Nearby Places</h1>
              <p>
                Enter a location and search radius to explore cities,
                landmarks, and hidden gems near you.
              </p>
            </div>

            <div className="form2">
              {/* Location Input */}
              <div className="input-group2">
                <label htmlFor="location">Location</label>
                <div className="input-wrapper2" style={{ position: "relative" }}>
                  <svg
                    className="icon2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <input
                    ref={locationInputRef}
                    id="location"
                    type="text"
                    value={location}
                    placeholder="Enter a city, address, or landmark"
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() =>
                      setTimeout(() => setShowSuggestions(false), 200)
                    }
                    aria-describedby={
                      showSuggestions && suggestions.length > 0
                        ? "location-suggestions"
                        : undefined
                    }
                    aria-expanded={showSuggestions && suggestions.length > 0}
                    aria-autocomplete="list"
                    role="combobox"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul
                      className="suggestions-list"
                      id="location-suggestions"
                      role="listbox"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: "1px solid #ccc",
                        zIndex: 10,
                      }}
                    >
                      {suggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="suggestion-item"
                          role="option"
                          tabIndex={-1}
                          style={{
                            padding: "8px",
                            cursor: "pointer",
                          }}
                        >
                          {suggestion.short_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Radius Dropdown */}
              <div className="input-group2">
                <label htmlFor="radius">Search Radius</label>
                <div className="input-wrapper2">
                  <svg
                    className="icon2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  <select
                    id="radius"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                  >
                    {[10, 20, 25, 50, 75, 100].map(
                      (miles) => (
                        <option key={miles} value={miles}>
                          {miles} miles
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Button */}
              <div className="button-wrapper2">
                <button onClick={handleSearch}>
                  <svg
                    className="icon2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Find Locations & Places Near It
                </button>
              </div>
            </div>
          </div>

          <div className="card-border-bottom2" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
