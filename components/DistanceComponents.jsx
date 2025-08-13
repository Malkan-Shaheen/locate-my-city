'use client';

import { FaGlobe, FaSun, FaWind, FaPlane, FaAnchor, FaClock } from 'react-icons/fa';
import { WiSunrise, WiSunset } from 'react-icons/wi';

export const MetricCard = ({ icon, title, value, unit, variant = 'blue' }) => {
  const variantClasses = {
    blue: 'distance-result__metric-card--blue',
    green: 'distance-result__metric-card--green',
    purple: 'distance-result__metric-card--purple',
    red: 'distance-result__metric-card--red'
  };

  return (
    <article 
      className={`distance-result__metric-card ${variantClasses[variant]}`}
      aria-labelledby={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="distance-result__metric-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 
        id={`metric-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className="distance-result__metric-title"
      >
        {title}
      </h3>
      <div className="distance-result__metric-values">
        <p className="distance-result__metric-value" aria-live="polite">
          {value} 
          <span className="sr-only"> {unit}</span>
        </p>
        <p className="distance-result__metric-unit" aria-hidden="true">
          {unit}
        </p>
      </div>
    </article>
  );
};

export const WeatherPanel = ({ location, weather, type }) => (
  <section 
    className={`distance-result__weather-panel distance-result__weather-panel--${type}`}
    aria-labelledby={`weather-panel-${type}-heading`}
  >
    <header className="distance-result__weather-header">
      <h3 
        id={`weather-panel-${type}-heading`}
        className="distance-result__weather-location"
      >
        {location}
      </h3>
    </header>
    <div className="distance-result__weather-content" role="list">
      <WeatherDetail 
        icon={<FaSun aria-hidden="true" />} 
        label="Temperature" 
        value={weather.temp} 
      />
      <WeatherDetail 
        icon={<FaWind aria-hidden="true" />} 
        label="Wind Speed" 
        value={weather.wind} 
      />
      <WeatherDetail 
        icon={<WiSunrise aria-hidden="true" />} 
        label="Sunrise" 
        value={weather.sunrise} 
      />
      <WeatherDetail 
        icon={<WiSunset aria-hidden="true" />} 
        label="Sunset" 
        value={weather.sunset} 
      />
      <WeatherDetail 
        icon={<FaGlobe aria-hidden="true" />} 
        label="Coordinates" 
        value={weather.coordinates} 
      />
      <WeatherDetail 
        icon={<span aria-hidden="true">$</span>} 
        label=" Currency" 
        value={weather.currency} 
      />
      <WeatherDetail 
        icon={<span aria-hidden="true" role="img" aria-label="Language">🗣️</span>} 
        label="Language" 
        value={weather.language} 
      />
      <WeatherDetail 
        icon={<FaClock aria-hidden="true" />} 
        label="Local Time" 
        value={weather.localtime} 
      />
    </div>
    
  </section>
);

const WeatherDetail = ({ icon, label, value }) => (
  <div className="distance-result__weather-detail" role="listitem">
    <div className="distance-result__weather-icon">
      {icon}
    </div>
    <div>
      <p className="distance-result__weather-label" id={`${label.replace(/\s+/g, '-').toLowerCase()}-label`}>
        {label}
      </p>
      <p 
        className="distance-result__weather-value"
        aria-labelledby={`${label.replace(/\s+/g, '-').toLowerCase()}-label`}
      >
        {value}
      </p>
    </div>
  </div>
);

export const FAQItem = ({ question, answer, isOpen, toggle, index }) => (
  <article className="distance-result__faq-item">
    <h4>
      <button
        id={`faq-question-${index}`}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${index}`}
        onClick={toggle}
        className={`distance-result__faq-question ${isOpen ? 'distance-result__faq-question--open' : ''}`}
      >
        <span>{question}</span>
        <span className="distance-result__faq-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
    </h4>
    <div
      id={`faq-answer-${index}`}
      role="region"
      aria-labelledby={`faq-question-${index}`}
      className={`distance-result__faq-answer ${isOpen ? 'distance-result__faq-answer--open' : ''}`}
      hidden={!isOpen}
    >
      <p>{answer}</p>
    </div>
  </article>
);

export const RouteCard = ({ source, destination, onClick }) => (
  <div className="distance-result__route-card-wrapper">
    <button 
      className="distance-result__route-card"
      onClick={onClick}
      aria-label={`Calculate distance between ${source} and ${destination}`}
    >
      <div className="distance-result__route-source">
        <div 
          className="distance-result__route-dot distance-result__route-dot--source"
          aria-hidden="true"
        ></div>
        <span>{source}</span>
      </div>
      <div className="distance-result__route-destination">
        <div 
          className="distance-result__route-dot distance-result__route-dot--destination"
          aria-hidden="true"
        ></div>
        <span>{destination}</span>
      </div>
      <div className="distance-result__route-footer">
        <span>Calculate distance</span>
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </div>
    </button>
  </div>
);

// Utility component for screen readers
const SrOnly = ({ children }) => (
  <span className="sr-only">{children}</span>
);
