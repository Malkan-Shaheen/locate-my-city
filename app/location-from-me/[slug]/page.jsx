'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import Footer from '../../../components/Footer';
import { 
  FaMapMarkerAlt, 
  FaRoad, 
  FaPlane, 
  FaWalking,
  FaGlobeAmericas as FaGlobe,
  FaMapMarkedAlt,
  FaSun,
  FaCloud,
  FaCloudRain,
  FaSnowflake,
  FaWind,
  FaArrowUp,
  FaArrowDown,
  FaUmbrella,
  FaCloudSun,
  FaBolt,
  FaClock,
  FaMoneyBillWave,
  FaLanguage
} from 'react-icons/fa';
import { useRouter, usePathname } from 'next/navigation';
import Header from '../../../components/Header';
import dynamic from 'next/dynamic';

// Lazy load the Map component with no SSR
const Map = dynamic(() => import('@/components/Map-comp'), { 
  ssr: false,
  loading: () => <div className="map-loading">Loading map...</div>
});

// Memoized helper functions
const toRad = (degrees) => degrees * Math.PI / 180;
const kmToMiles = (km) => km * 0.621371;
const formatTime = (timestamp, timezone) => {
  const date = new Date((timestamp + timezone) * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getFirstCurrency = (currencies) => {
  if (!currencies) return null;
  const currencyCode = Object.keys(currencies)[0];
  const currency = currencies[currencyCode];
  return `${currencyCode} (${currency.symbol || ''})`;
};

const formatTimezone = (timezone) => {
  if (!timezone) return '--';
  try {
    const offset = new Date().toLocaleString('en', { timeZone: timezone, timeZoneName: 'short' }).split(' ').pop();
    return offset;
  } catch {
    return timezone.split('/').pop() || '--';
  }
};

// Weather icon mapping
const WEATHER_ICONS = {
  clear: { icon: FaSun, color: '#FFD700' },
  clouds: { icon: FaCloud, color: '#A9A9A9' },
  rain: { icon: FaCloudRain, color: '#4682B4' },
  drizzle: { icon: FaUmbrella, color: '#4682B4' },
  thunderstorm: { icon: FaBolt, color: '#9400D3' },
  snow: { icon: FaSnowflake, color: '#E0FFFF' },
  default: { icon: FaCloudSun, color: '#A9A9A9' }
};

export default function DistanceResult() {
  // State declarations
  const [userLatitude, setUserLatitude] = useState(null);
  const [userLongitude, setUserLongitude] = useState(null);
  const [destinationPlace, setDestinationPlace] = useState(null);
  const [distanceInKm, setDistanceInKm] = useState(0);
  const [unit, setUnit] = useState('km');
  const [currentLocationText, setCurrentLocationText] = useState('');
  const [destinationCoords, setDestinationCoords] = useState('--');
  const [destinationCountry, setDestinationCountry] = useState('--');
  const [destinationName, setDestinationName] = useState('--');
  const [isCalculating, setIsCalculating] = useState(false);
  const [travelTime, setTravelTime] = useState({
    driving: null,
    flying: null,
    walking: null
  });
  const [weather, setWeather] = useState({
    loading: true,
    condition: '',
    description: '',
    temperature: 0,
    feelsLike: 0,
    windSpeed: 0,
    humidity: 0,
    sunrise: '',
    sunset: '',
    icon: ''
  });
  const [countryInfo, setCountryInfo] = useState({
    currency: '--',
    languages: '--',
    timezone: '--'
  });
  const [neighboringCountries, setNeighboringCountries] = useState([]);
  const [loadingNeighbors, setLoadingNeighbors] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // Memoized destination from path
  const destination = useMemo(() => {
    if (pathname) {
      const pathMatch = pathname.match(/how-far-is-(.+?)(-from-me)?$/);
      if (pathMatch) {
        const rawName = pathMatch[1];
        return decodeURIComponent(rawName).replace(/-/g, ' ').trim();
      }
    }
    return null;
  }, [pathname]);

  // Clean up URL if needed
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname?.includes('/how-far-is-') && pathname.split('/').length > 3) {
      const cleanPath = pathname.split('/').slice(0, 3).join('/');
      window.history.replaceState(null, '', cleanPath);
    }
  }, [pathname]);

  // Set destination name when destination changes
  useEffect(() => {
    if (destination) {
      setDestinationName(destination);
    }
  }, [destination]);

  // Fetch place details with debounce
  const getPlaceDetails = useCallback(async (address) => {
    if (!address.trim()) return;

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const place = data[0];
        setDestinationPlace(place);
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        
        setDestinationCoords(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        setDestinationCountry(place.display_name.split(',').pop().trim() || '--');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }, []);

  // Debounced version of getPlaceDetails
  useEffect(() => {
    if (!destination) return;
    
    const timer = setTimeout(() => {
      getPlaceDetails(destination);
    }, 300);

    return () => clearTimeout(timer);
  }, [destination, getPlaceDetails]);

  // Calculate distance with memoization
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    setIsCalculating(true);
    
    setTimeout(() => {
      const R = 6371; // Earth radius in km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      setDistanceInKm(distance);
      calculateTravelTimes(distance);
      setIsCalculating(false);
    }, 500);
  }, []);

  const calculateTravelTimes = useCallback((distance) => {
    setTravelTime({
      driving: `${(distance / 80).toFixed(1)} hours`,
      flying: `${(distance / 800).toFixed(1)} hours`,
      walking: `${(distance / 5).toFixed(1)} hours`
    });
  }, []);

  // Recalculate when both locations are available
  useEffect(() => {
    if (userLatitude && userLongitude && destinationPlace) {
      calculateDistance(
        userLatitude,
        userLongitude,
        parseFloat(destinationPlace.lat),
        parseFloat(destinationPlace.lon)
      );
      fetchWeatherData(
        parseFloat(destinationPlace.lat),
        parseFloat(destinationPlace.lon)
      );
    }
  }, [userLatitude, userLongitude, destinationPlace, calculateDistance]);

  // Optimized weather data fetch
  const fetchWeatherData = useCallback(async (lat, lon) => {
    try {
      setWeather(prev => ({ ...prev, loading: true }));
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=953d1012b9ab5d4722d58e46be4305f7&units=metric`
      );
      const data = await response.json();
      
      if (data.cod === 200) {
        setWeather({
          loading: false,
          condition: data.weather[0].main.toLowerCase(),
          description: data.weather[0].description,
          temperature: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          windSpeed: Math.round(data.wind.speed * 3.6),
          humidity: data.main.humidity,
          sunrise: formatTime(data.sys.sunrise, data.timezone),
          sunset: formatTime(data.sys.sunset, data.timezone),
          icon: data.weather[0].icon
        });
      } else {
        throw new Error(data.message || 'Failed to fetch weather data');
      }
    } catch (error) {
      console.error('Weather API error:', error);
      setWeather(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load weather data'
      }));
    }
  }, []);

  // Optimized country data fetch
  const fetchCountryData = useCallback(async (countryName) => {
    if (!countryName || countryName === '--') return;
    
    try {
      const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`);
      if (!response.ok) throw new Error('Failed to fetch country data');
      
      const data = await response.json();
      if (data && data.length > 0) {
        const country = data[0];
        setCountryInfo({
          currency: getFirstCurrency(country.currencies) || '--',
          languages: country.languages ? Object.values(country.languages).join(', ') : '--',
          timezone: country.timezones?.[0] ? formatTimezone(country.timezones[0]) : '--'
        });

        if (country.borders && country.borders.length > 0) {
          fetchNeighboringCountries(country.borders);
        }
      }
    } catch (error) {
      console.error('Error fetching country info:', error);
      setCountryInfo({
        currency: '--',
        languages: '--',
        timezone: '--'
      });
    }
  }, []);

  // Fetch country data when destination country changes
  useEffect(() => {
    fetchCountryData(destinationCountry);
  }, [destinationCountry, fetchCountryData]);

  const fetchNeighboringCountries = useCallback(async (borderCodes) => {
    setLoadingNeighbors(true);
    try {
      const response = await fetch(`https://restcountries.com/v3.1/alpha?codes=${borderCodes.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch neighboring countries');
      
      const data = await response.json();
      setNeighboringCountries(data.map(country => ({
        name: country.name.common,
        code: country.cca2
      })));
    } catch (error) {
      console.error('Error fetching neighboring countries:', error);
      setNeighboringCountries([]);
    } finally {
      setLoadingNeighbors(false);
    }
  }, []);

  // Optimized geolocation
  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setCurrentLocationText('Geolocation not supported');
      alert('Geolocation is not supported by your browser. Please enter your location manually.');
      return;
    }

    try {
      const permissionResult = await navigator.permissions.query({ name: 'geolocation' });
      if (permissionResult.state === 'denied') {
        setCurrentLocationText('Location permission denied');
        alert('Please enable location permissions to use this feature.');
        return;
      }
    } catch (error) {
      console.log('Permission API not supported, proceeding with geolocation');
    }

    setCurrentLocationText('Detecting your location...');
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLatitude(lat);
      setUserLongitude(lng);
      setCurrentLocationText('Location detected!');
      
      // Reverse geocode in background without blocking
      setTimeout(() => reverseGeocode(lat, lng), 0);
    } catch (error) {
      setCurrentLocationText('Could not detect location');
      alert('Could not detect your location. Please enter it manually.');
    }
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.display_name) {
        setCurrentLocationText(data.display_name);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  }, []);

  const handleManualLocation = useCallback(async (address) => {
    if (!address.trim()) {
      alert('Please enter a location');
      return;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const place = data[0];
        setUserLatitude(parseFloat(place.lat));
        setUserLongitude(parseFloat(place.lon));
        setCurrentLocationText(place.display_name);
      } else {
        alert('Location not found. Please try a different address.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Error finding location. Please try again.');
    }
  }, []);

  const handleUnitChange = useCallback((newUnit) => setUnit(newUnit), []);
  
  const capitalizeWords = useCallback((str) => {
    if (!str) return '';
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }, []);

  // Memoized weather icon
  const weatherIcon = useMemo(() => {
    if (weather.loading) return <div className="spinner small"></div>;
    if (weather.error) return <div className="weather-error">{weather.error}</div>;

    const iconStyle = { 
      fontSize: '3rem',
      marginBottom: '10px'
    };

    const { icon, color } = WEATHER_ICONS[weather.condition] || WEATHER_ICONS.default;
    const IconComponent = icon;
    return <IconComponent style={{...iconStyle, color}} />;
  }, [weather]);

  // Memoized coordinates for the map
  const sourceCoords = useMemo(() => userLatitude && userLongitude ? { 
    lat: parseFloat(userLatitude), 
    lng: parseFloat(userLongitude) 
  } : null, [userLatitude, userLongitude]);

  const destCoords = useMemo(() => destinationPlace ? { 
    lat: parseFloat(destinationPlace.lat), 
    lng: parseFloat(destinationPlace.lon) 
  } : null, [destinationPlace]);

  // Memoized distance display
  const distanceDisplay = useMemo(() => {
    if (!sourceCoords) {
      return (
        <div className="empty-distance">
          <span className="empty-value">-- {unit === 'km' ? 'km' : 'mi'}</span>
          <span className="unit-hint"> </span>
        </div>
      );
    }

    if (isCalculating || distanceInKm <= 0) {
      return <div className="spinner"></div>;
    }

    return unit === 'km' 
      ? `${distanceInKm.toFixed(1)} km` 
      : `${kmToMiles(distanceInKm).toFixed(1)} mi`;
  }, [sourceCoords, isCalculating, distanceInKm, unit]);

  // Memoized neighboring countries list
  const neighboringCountriesList = useMemo(() => {
    if (loadingNeighbors) return <div className="spinner small"></div>;
    if (neighboringCountries.length === 0) return <p>No neighboring countries found or data unavailable.</p>;

    return (
      <ul className="routes-list">
        {neighboringCountries.map((country, index) => {
          const destSlug = destinationName
            .split(',')[0]
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
            
          const countrySlug = country.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          return (
            <li key={index} className="route-item">
              <Link 
                href={`/location-from-location/how-far-is-${countrySlug}-from-${destSlug}`}
                className="route-link"
                prefetch={false}
              >
                How far is {country.name} from {destinationName.split(',')[0]}?
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }, [loadingNeighbors, neighboringCountries, destinationName]);

  // Memoized popular routes
  const popularRoutes = useMemo(() => (
    <ul className="routes-list">
      {[
        'New York',
        'London',
        'Tokyo',
        'Los Angeles'
      ].map((city, index) => {
        const destSlug = destinationName
          .split(',')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
          
        const citySlug = city
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        return (
          <li key={index}>
            <Link 
              href={`/location-from-location/how-far-is-${citySlug}-from-${destSlug}`}
              prefetch={false}
            >
              {city} to {destinationName.split(',')[0]}
            </Link>
          </li>
        );
      })}
    </ul>
  ), [destinationName]);

  return (
    <>
      <Header />
      <Head>
        <title>How far is {capitalizeWords(destinationName)} from me? | LocateMyCity</title>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <meta name="robots" content="index, follow" />
      </Head>

      <main className="distance-page">
        <div className="page-header">
          <h1>How far is {capitalizeWords(destinationName)} from me?</h1>
          <p className="description">
            Find out exactly how far {capitalizeWords(destinationName)} is from your current location. 
            Use our interactive tool to calculate the distance in miles, kilometers, 
            or nautical miles. Includes weather, nearby places, and travel insights.
          </p>
        </div>

        {/* Source Location Input Box */}
        <div className="source-input-container">
          <div className="source-input-box">
            <input
              type="text"
              placeholder="Enter your location"
              value={currentLocationText}
              onChange={(e) => setCurrentLocationText(e.target.value)}
              className="source-input"
              aria-label="Enter your current location"
            />
            <div className="source-buttons">
              <button 
                className="my-location-btn"
                onClick={getLocation}
                aria-label="Use my current location"
              >
                <FaMapMarkerAlt style={{ marginRight: '8px' }} />
                Use My Location
              </button>
              <button 
                className="calculate-btn"
                onClick={() => handleManualLocation(currentLocationText)}
                aria-label="Set location manually"
              >
                Set Location
              </button>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="map-container">
          <Map 
            sourceCoords={sourceCoords}
            destinationCoords={destCoords}
            distance={sourceCoords ? distanceInKm : null}
          />
          {!sourceCoords && (
            <div className="map-overlay-message">
              <FaMapMarkerAlt className="marker-icon" />
              <p> calculating...</p>
            </div>
          )}
        </div>

        <div className="cards-container">
          <div className="info-card">
            <h1>Distance to Destination</h1>
            
            <div className="distance-value" role="status" aria-live="polite">
              {distanceDisplay}
            </div>

            <div className="unit-toggle" role="group" aria-label="Distance unit selection">
              <button 
                className={`unit-btn ${unit === 'km' ? 'active' : ''}`}
                onClick={() => handleUnitChange('km')}
                aria-pressed={unit === 'km'}
              >
                Kilometers
              </button>
              <button 
                className={`unit-btn ${unit === 'mi' ? 'active' : ''}`}
                onClick={() => handleUnitChange('mi')}
                aria-pressed={unit === 'mi'}
              >
                Miles
              </button>
            </div>

            <div className="travel-times">
              <h4>Estimated Travel Times</h4>
              <div className="travel-method">
                <FaRoad className="method-icon" />
                <span>Driving: {sourceCoords ? (travelTime.driving || 'Calculating...') : '--'}</span>
              </div>
              <div className="travel-method">
                <FaPlane className="method-icon" />
                <span>Flying: {sourceCoords ? (travelTime.flying || 'Calculating...') : '--'}</span>
              </div>
              <div className="travel-method">
                <FaWalking className="method-icon" />
                <span>Walking: {sourceCoords ? (travelTime.walking || 'Calculating...') : '--'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Destination info cards */}
        <div className="cards-container">
          {/* Weather Card */}
          <div className="info-card weather-card">
            <h3>Current Weather</h3>
            <div className="weather-display">
              {weatherIcon}
              {!weather.loading && !weather.error && (
                <>
                  <div className="temperature">{weather.temperature}°C</div>
                  <div className="weather-description">{weather.description}</div>
                </>
              )}
            </div>

            <div className="info-card">
              <div className="detail-item">
                <FaSun style={{ color: '#FFA500', fontSize: '1.5rem' }} />
                <div>
                  <h4>Temperature</h4>
                  <p>{weather.temperature}°C (Feels like {weather.feelsLike}°C)</p>
                </div>
              </div>

              <div className="detail-item">
                <FaWind style={{ color: '#4682B4', fontSize: '1.5rem' }} />
                <div>
                  <h4>Wind</h4>
                  <p>{weather.windSpeed} km/h</p>
                </div>
              </div>

              <div className="detail-item">
                <FaUmbrella style={{ color: '#4682B4', fontSize: '1.5rem' }} />
                <div>
                  <h4>Humidity</h4>
                  <p>{weather.humidity}%</p>
                </div>
              </div>

              <div className="detail-item">
                <FaArrowUp style={{ color: '#FFA500', fontSize: '1.5rem' }} />
                <div>
                  <h4>Sunrise</h4>
                  <p>{weather.sunrise}</p>
                </div>
              </div>

              <div className="detail-item">
                <FaArrowDown style={{ color: '#FF6347', fontSize: '1.5rem' }} />
                <div>
                  <h4>Sunset</h4>
                  <p>{weather.sunset}</p>
                </div>
              </div>
            </div>
          </div>

          {/* General Info Card */}
          <div className="info-card">
            <h3>General Information</h3>
            <div className="detail-item">
              <FaMapMarkerAlt className="detail-icon location-icon" />
              <div>
                <h4>Location</h4>
                <p>{destinationName}</p>
              </div>
            </div>
            <div className="detail-item">
              <FaGlobe className="detail-icon globe-icon" />
              <div>
                <h4>Country/Region</h4>
                <p>{destinationCountry}</p>
              </div>
            </div>
            <div className="detail-item">
              <FaMapMarkedAlt className="detail-icon coordinates-icon" />
              <div>
                <h4>GPS Coordinates</h4>
                <p className="coordinates">{destinationCoords}</p>
              </div>
            </div>
            <div className="detail-item">
              <FaClock className="detail-icon timezone-icon" />
              <div>
                <h4>Timezone</h4>
                <p>{countryInfo.timezone}</p>
              </div>
            </div>
            <div className="detail-item">
              <FaMoneyBillWave className="detail-icon currency-icon" />
              <div>
                <h4>Currency</h4>
                <p>{countryInfo.currency}</p>
              </div>
            </div>
            <div className="detail-item">
              <FaLanguage className="detail-icon language-icon" />
              <div>
                <h4>Language</h4>
                <p>{countryInfo.languages}</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="page-footer">
          <div className="footer-section">
            <h4>How far is {destinationName} from neighboring countries?</h4>
            {neighboringCountriesList}
          </div>
          <div className="footer-section">
            <h4>Popular Routes to {destinationName.split(',')[0]}</h4>
            {popularRoutes}
          </div>
        </footer>
      </main>
      <Footer />
    </>
  );
}