'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import LocationInput from './LocationInput';

export default function DistanceCalculator() {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [sourcePlace, setSourcePlace] = useState(null);
  const [destinationPlace, setDestinationPlace] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCalculate = () => {
    if (!sourcePlace || !destinationPlace) {
      alert('Please select valid source and destination locations');
      return;
    }

    setIsLoading(true);
    
    // Generate clean URL segments
    const sourceSlug = sourcePlace.display_name
      .split(',')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const destSlug = destinationPlace.display_name
      .split(',')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Navigate to the clean URL
    router.push(`/location-from-location/how-far-is-${sourceSlug}-from-${destSlug}`);
  };

  return (
    <>
    <Header />
<Head>
  <title>Distance Calculator | LocateMyCity</title>
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" href="/images/cityfav.png" />
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
  />
</Head>

<main className="main2">
  <div className="card2">
    <div className="card-border-top2" />
    <div className="card-content2">
      <div className="heading2">
        <h1>Distance Calculator</h1>
        <p>Find the exact distance between two locations worldwide.</p>
      </div>

      <div className="form2">
        {/* Source Location */}
        <div className="input-group2">
          <LocationInput
            label="Source Location"
            value={source}
            onChange={setSource}
            onPlaceSelect={setSourcePlace}
            placeholder="Enter address, city, or landmark"
          />
        </div>

        {/* Destination Location */}
        <div className="input-group2">
          <LocationInput
            label="Destination Location"
            value={destination}
            onChange={setDestination}
            onPlaceSelect={setDestinationPlace}
            placeholder="Enter address, city, or landmark"
          />
        </div>

        {/* Button */}
        <div className="button-wrapper2">
          <button onClick={handleCalculate}>
            {isLoading ? (
              <span>
                <span className="spinner"></span> Calculating
              </span>
            ) : (
              <>
                <span>Calculate Distance</span>
                <i className="fas fa-arrow-right" style={{ marginLeft: "8px" }}></i>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    <div className="card-border-bottom2" />
  </div>
</main>
<Footer />

    </>
  );
}
