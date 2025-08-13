import { useState, useEffect, useRef } from 'react';

export default function LocationInput({ label, value, onChange, onPlaceSelect, placeholder }) {
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
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url);
    
    if (response.status === 429) {
      console.warn('API rate limit exceeded');
      return;
    }

    const data = await response.json();
    console.log('API Response:', data); // Keep this for debugging

    const filtered = data.map(item => {
      // For countries, use the display_name directly
      if (item.type === 'administrative' && item.address?.country) {
        return {
          ...item,
          display_name: item.address.country,
          full_display: item.display_name
        };
      }

      // For other types, try to extract the most relevant name
      const mainName = item.address?.city || item.address?.town || 
                      item.address?.village || item.address?.hamlet ||
                      item.address?.municipality || item.address?.state ||
                      item.display_name.split(',')[0];

      return {
        ...item,
        display_name: mainName,
        full_display: item.display_name
      };
    }).filter(item => item.display_name); // Filter out any empty names

    setSuggestions(filtered);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    setSuggestions([]);
  } finally {
    setIsFetching(false);
  }
};

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (val.length > 1) {
      fetchSuggestions(val);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion) => {
    onChange(suggestion.display_name);
    onPlaceSelect(suggestion);
    setShowSuggestions(false);
  };

  const inputId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="form-group" ref={containerRef}>
      <label htmlFor={inputId}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input 
          type="text" 
          id={inputId}
          className="form-control" 
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          aria-describedby={showSuggestions && suggestions.length > 0 ? `${inputId}-suggestions` : undefined}
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-autocomplete="list"
          role="combobox"
        />
        
        {showSuggestions && (isFetching ? (
          <div className="suggestions-dropdown" role="status" aria-live="polite">
            <div className="loading-suggestion">Loading suggestions...</div>
          </div>
        ) : suggestions.length > 0 ? (
          <ul className="suggestions-dropdown" id={`${inputId}-suggestions`} role="listbox">
            {suggestions.map((suggestion, index) => (
              <li 
                key={index}
                onClick={() => selectSuggestion(suggestion)}
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
        ) : value.length > 1 && (
          <div className="suggestions-dropdown" role="status">
            <div className="no-suggestions">No locations found</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .form-group {
          margin-bottom: 25px;
          position: relative;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #444;
        }

        .form-control {
          width: 100%;
          padding: 12px 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #f9f9f9;
        }

        .form-control:focus {
          border-color: #4682B4;
          box-shadow: 0 0 0 3px rgba(70, 130, 180, 0.2);
          outline: none;
          background: white;
        }

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

        .suggestions-dropdown li:not(:last-child) {
          border-bottom: 1px solid #eee;
        }
      `}</style>
    </div>
  );
}